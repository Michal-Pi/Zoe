// Experiment resolver — determines which arm a user is assigned to
// and whether a shadow run should execute.

import { createHash } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Arm, ExperimentDecision, TriageExperiment } from "./types";

/** Deterministic hash → float in [0, 1) */
function hashToFloat(input: string): number {
  const hex = createHash("sha256").update(input).digest("hex");
  return parseInt(hex.slice(0, 8), 16) / 0xffffffff;
}

/** Pick an arm based on weights and a deterministic hash */
function pickArm(weights: Record<Arm, number>, hashValue: number): Arm {
  const total = (weights.A ?? 0) + (weights.B ?? 0) + (weights.C ?? 0);
  if (total === 0) return "A";

  const normalized = hashValue * total;
  const wA = weights.A ?? 0;
  const wB = weights.B ?? 0;

  if (normalized < wA) return "A";
  if (normalized < wA + wB) return "B";
  return "C";
}

const NO_EXPERIMENT: ExperimentDecision = {
  experimentId: null,
  experimentVersion: 0,
  primaryArm: "A",
  shadowArm: null,
};

export async function resolveExperiment(
  userId: string
): Promise<ExperimentDecision> {
  const supabase = await createServiceRoleClient();

  // 1. Find the single active experiment
  const { data: experiment } = await supabase
    .from("triage_experiments")
    .select("*")
    .eq("status", "active")
    .limit(1)
    .single();

  if (!experiment) return NO_EXPERIMENT;

  const exp = experiment as TriageExperiment;

  // 2. Check for a manual override
  const { data: override } = await supabase
    .from("triage_assignment_overrides")
    .select("arm")
    .eq("experiment_id", exp.id)
    .eq("user_id", userId)
    .limit(1)
    .single();

  let primaryArm: Arm;

  if (override) {
    primaryArm = override.arm as Arm;
  } else {
    // 3. Check for a cached assignment at this version
    const { data: existing } = await supabase
      .from("triage_assignments")
      .select("arm")
      .eq("experiment_id", exp.id)
      .eq("experiment_version", exp.version)
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (existing) {
      primaryArm = existing.arm as Arm;
    } else {
      // 4. Deterministic assignment via hash
      const h = hashToFloat(`${userId}:${exp.id}:${exp.version}`);
      primaryArm = pickArm(exp.arm_weights as Record<Arm, number>, h);

      // Cache it
      await supabase.from("triage_assignments").insert({
        experiment_id: exp.id,
        experiment_version: exp.version,
        user_id: userId,
        arm: primaryArm,
      });
    }
  }

  // 5. Determine shadow arm
  let shadowArm: Arm | null = null;
  if (
    exp.shadow_enabled &&
    exp.shadow_arm &&
    exp.shadow_arm !== primaryArm
  ) {
    // Use a separate hash seed so shadow sampling is independent of arm assignment
    const shadowHash = hashToFloat(`shadow:${userId}:${exp.id}:${exp.version}`);
    if (shadowHash < exp.shadow_sample_rate) {
      shadowArm = exp.shadow_arm as Arm;
    }
  }

  return {
    experimentId: exp.id,
    experimentVersion: exp.version,
    primaryArm,
    shadowArm,
  };
}

// Fire-and-forget triage result persistence — same pattern as llm-costs.ts

import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Arm, RouteResult } from "./types";

interface RecordInput {
  experimentId: string;
  userId: string;
  arm: Arm;
  isShadow: boolean;
  results: RouteResult[];
}

export function recordTriageResults(input: RecordInput): void {
  if (!input.experimentId || !input.results.length) return;

  persistResults(input).catch((err) => {
    console.error("Failed to persist triage results:", err);
  });
}

async function persistResults(input: RecordInput): Promise<void> {
  const supabase = await createServiceRoleClient();

  const rows = input.results.map((r) => ({
    signal_id: r.signalId,
    experiment_id: input.experimentId,
    user_id: input.userId,
    arm: input.arm,
    is_shadow: input.isShadow,
    urgency_score: r.urgencyScore,
    topic_cluster: r.topicCluster,
    ownership_signal: r.ownershipSignal,
    requires_response: r.requiresResponse,
    escalation_level: r.escalationLevel,
    confidence: r.confidence,
    used_heuristic: r.usedHeuristic,
    used_snippet_model: r.usedSnippetModel,
    used_full_model: r.usedFullModel,
    model_name: r.modelName,
    input_tokens: r.inputTokens,
    output_tokens: r.outputTokens,
    estimated_cost_usd: r.estimatedCostUsd,
    latency_ms: r.latencyMs,
    reason_codes: r.reasonCodes,
  }));

  const { error } = await supabase.from("triage_results").insert(rows);

  if (error) {
    console.error("triage_results insert error:", error);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createServiceRoleClient,
  createServerSupabaseClient,
} from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized", status: 401 } as const;

  const serviceClient = await createServiceRoleClient();
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) return { error: "Forbidden", status: 403 } as const;

  return { serviceClient, user } as const;
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: experiments, error } = await auth.serviceClient
    .from("triage_experiments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch assignment counts per experiment
  const experimentIds = (experiments ?? []).map((e) => e.id);
  let assignmentCounts: Record<string, Record<string, number>> = {};

  if (experimentIds.length) {
    const { data: assignments } = await auth.serviceClient
      .from("triage_assignments")
      .select("experiment_id, arm")
      .in("experiment_id", experimentIds);

    for (const a of assignments ?? []) {
      if (!assignmentCounts[a.experiment_id]) {
        assignmentCounts[a.experiment_id] = {};
      }
      assignmentCounts[a.experiment_id][a.arm] =
        (assignmentCounts[a.experiment_id][a.arm] ?? 0) + 1;
    }
  }

  // Fetch result counts per experiment
  let resultCounts: Record<string, { primary: number; shadow: number }> = {};

  if (experimentIds.length) {
    const { data: results } = await auth.serviceClient
      .from("triage_results")
      .select("experiment_id, is_shadow")
      .in("experiment_id", experimentIds);

    for (const r of results ?? []) {
      if (!resultCounts[r.experiment_id]) {
        resultCounts[r.experiment_id] = { primary: 0, shadow: 0 };
      }
      if (r.is_shadow) {
        resultCounts[r.experiment_id].shadow++;
      } else {
        resultCounts[r.experiment_id].primary++;
      }
    }
  }

  return NextResponse.json({
    data: {
      experiments: experiments ?? [],
      assignmentCounts,
      resultCounts,
    },
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  arm_weights: z
    .object({
      A: z.number().int().min(0).max(100),
      B: z.number().int().min(0).max(100),
      C: z.number().int().min(0).max(100),
    })
    .refine((w) => w.A + w.B + w.C === 100, "Weights must sum to 100"),
  shadow_enabled: z.boolean().optional(),
  shadow_arm: z.enum(["A", "B", "C"]).nullable().optional(),
  shadow_sample_rate: z.number().min(0).max(1).optional(),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body;
  try {
    body = createSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof z.ZodError ? err.issues : "Invalid input" },
      { status: 400 }
    );
  }

  const { data: experiment, error } = await auth.serviceClient
    .from("triage_experiments")
    .insert({
      name: body.name,
      description: body.description ?? null,
      arm_weights: body.arm_weights,
      shadow_enabled: body.shadow_enabled ?? false,
      shadow_arm: body.shadow_arm ?? null,
      shadow_sample_rate: body.shadow_sample_rate ?? 0.05,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: experiment }, { status: 201 });
}

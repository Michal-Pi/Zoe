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

const patchSchema = z.object({
  status: z.enum(["draft", "active", "paused", "completed"]).optional(),
  arm_weights: z
    .object({
      A: z.number().int().min(0).max(100),
      B: z.number().int().min(0).max(100),
      C: z.number().int().min(0).max(100),
    })
    .refine((w) => w.A + w.B + w.C === 100, "Weights must sum to 100")
    .optional(),
  shadow_enabled: z.boolean().optional(),
  shadow_arm: z.enum(["A", "B", "C"]).nullable().optional(),
  shadow_sample_rate: z.number().min(0).max(1).optional(),
  bump_version: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  let body;
  try {
    body = patchSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof z.ZodError ? err.issues : "Invalid input" },
      { status: 400 }
    );
  }

  // If activating, pause any other active experiments
  if (body.status === "active") {
    await auth.serviceClient
      .from("triage_experiments")
      .update({ status: "paused", updated_at: new Date().toISOString() })
      .eq("status", "active")
      .neq("id", id);
  }

  // Build update payload
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.status !== undefined) update.status = body.status;
  if (body.arm_weights !== undefined) update.arm_weights = body.arm_weights;
  if (body.shadow_enabled !== undefined) update.shadow_enabled = body.shadow_enabled;
  if (body.shadow_arm !== undefined) update.shadow_arm = body.shadow_arm;
  if (body.shadow_sample_rate !== undefined) update.shadow_sample_rate = body.shadow_sample_rate;

  // Version bump: fetch current version and increment
  if (body.bump_version) {
    const { data: current } = await auth.serviceClient
      .from("triage_experiments")
      .select("version")
      .eq("id", id)
      .single();
    update.version = (current?.version ?? 0) + 1;
  }

  const { data: experiment, error } = await auth.serviceClient
    .from("triage_experiments")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: experiment });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  const { error } = await auth.serviceClient
    .from("triage_experiments")
    .update({
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: { archived: true } });
}

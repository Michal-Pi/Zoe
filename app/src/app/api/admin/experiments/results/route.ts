import { NextResponse } from "next/server";
import {
  createServiceRoleClient,
  createServerSupabaseClient,
} from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = await createServiceRoleClient();
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const experimentId = searchParams.get("experiment_id");

  if (!experimentId) {
    return NextResponse.json(
      { error: "experiment_id is required" },
      { status: 400 }
    );
  }

  // Fetch all results for this experiment
  const { data: results, error } = await serviceClient
    .from("triage_results")
    .select(
      "arm, is_shadow, urgency_score, requires_response, ownership_signal, escalation_level, confidence, used_heuristic, used_full_model, input_tokens, output_tokens, estimated_cost_usd, latency_ms, signal_id"
    )
    .eq("experiment_id", experimentId)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = results ?? [];

  // Aggregate by arm + shadow
  type ArmKey = string; // "A:primary" | "A:shadow" | etc
  const aggregates: Record<
    ArmKey,
    {
      arm: string;
      isShadow: boolean;
      count: number;
      totalCost: number;
      totalLatency: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      heuristicCount: number;
      llmCount: number;
      requiresResponseCount: number;
      avgConfidence: number;
    }
  > = {};

  for (const r of rows) {
    const key = `${r.arm}:${r.is_shadow ? "shadow" : "primary"}`;
    if (!aggregates[key]) {
      aggregates[key] = {
        arm: r.arm,
        isShadow: r.is_shadow,
        count: 0,
        totalCost: 0,
        totalLatency: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        heuristicCount: 0,
        llmCount: 0,
        requiresResponseCount: 0,
        avgConfidence: 0,
      };
    }
    const agg = aggregates[key];
    agg.count++;
    agg.totalCost += Number(r.estimated_cost_usd ?? 0);
    agg.totalLatency += r.latency_ms ?? 0;
    agg.totalInputTokens += r.input_tokens ?? 0;
    agg.totalOutputTokens += r.output_tokens ?? 0;
    if (r.used_heuristic) agg.heuristicCount++;
    if (r.used_full_model) agg.llmCount++;
    if (r.requires_response) agg.requiresResponseCount++;
    agg.avgConfidence += r.confidence ?? 0;
  }

  const armSummaries = Object.values(aggregates).map((agg) => ({
    arm: agg.arm,
    isShadow: agg.isShadow,
    count: agg.count,
    avgCostPerSignal: agg.count > 0 ? agg.totalCost / agg.count : 0,
    avgLatencyMs: agg.count > 0 ? Math.round(agg.totalLatency / agg.count) : 0,
    avgConfidence: agg.count > 0 ? agg.avgConfidence / agg.count : 0,
    totalInputTokens: agg.totalInputTokens,
    totalOutputTokens: agg.totalOutputTokens,
    totalCost: agg.totalCost,
    heuristicRate: agg.count > 0 ? agg.heuristicCount / agg.count : 0,
    llmRate: agg.count > 0 ? agg.llmCount / agg.count : 0,
    requiresResponseRate:
      agg.count > 0 ? agg.requiresResponseCount / agg.count : 0,
  }));

  // Agreement analysis — for signals with both primary and shadow results
  const bySignal = new Map<
    string,
    { primary: (typeof rows)[number] | null; shadow: (typeof rows)[number] | null }
  >();

  for (const r of rows) {
    const entry = bySignal.get(r.signal_id) ?? { primary: null, shadow: null };
    if (r.is_shadow) {
      entry.shadow = r;
    } else {
      entry.primary = r;
    }
    bySignal.set(r.signal_id, entry);
  }

  let comparedCount = 0;
  let requiresResponseAgree = 0;
  let ownershipAgree = 0;
  let escalationAgree = 0;
  let urgencyCloseCount = 0;

  for (const { primary, shadow } of bySignal.values()) {
    if (!primary || !shadow) continue;
    comparedCount++;
    if (primary.requires_response === shadow.requires_response) requiresResponseAgree++;
    if (primary.ownership_signal === shadow.ownership_signal) ownershipAgree++;
    if (primary.escalation_level === shadow.escalation_level) escalationAgree++;
    if (
      primary.urgency_score != null &&
      shadow.urgency_score != null &&
      Math.abs(primary.urgency_score - shadow.urgency_score) <= 15
    ) {
      urgencyCloseCount++;
    }
  }

  const agreement =
    comparedCount > 0
      ? {
          comparedCount,
          requiresResponseRate: requiresResponseAgree / comparedCount,
          ownershipRate: ownershipAgree / comparedCount,
          escalationRate: escalationAgree / comparedCount,
          urgencyCloseRate: urgencyCloseCount / comparedCount,
        }
      : null;

  return NextResponse.json({
    data: {
      armSummaries,
      agreement,
      totalResults: rows.length,
    },
  });
}

import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { classifySignals } from "@/lib/signals/classifier";
import { runScoringEngine } from "@/lib/signals/scoring-engine";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = await createServiceRoleClient();
  const [{ count: remainingBefore }] = await Promise.all([
    serviceClient
      .from("signals")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("classified_at", null),
  ]);

  const classifyResult = await classifySignals(user.id);
  const scoringResult = await runScoringEngine(user.id);

  const [{ count: remainingAfter }, { count: readyActivities }] = await Promise.all([
    serviceClient
      .from("signals")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("classified_at", null),
    serviceClient
      .from("activities")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("status", ["pending", "in_progress"]),
  ]);

  return NextResponse.json({
    classified: classifyResult.classified,
    classificationErrors: classifyResult.errors,
    activitiesCreated: scoringResult.activitiesCreated,
    clusteringErrors: scoringResult.errors,
    remainingBefore: remainingBefore ?? 0,
    remainingAfter: remainingAfter ?? 0,
    readyActivities: readyActivities ?? 0,
    errorDetails: [...classifyResult.errorDetails, ...scoringResult.errorDetails].slice(0, 10),
  });
}

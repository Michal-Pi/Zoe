import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { runScoringEngine } from "@/lib/signals/scoring-engine";

// Runs every 3 minutes — clusters signals into work objects and extracts scored activities
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceRoleClient();

  // Find users who have classified signals not yet linked to any work object.
  // This avoids running the scoring engine for users with nothing to process.
  const { data: unlinkedSignals } = await supabase
    .from("signals")
    .select("user_id, id")
    .not("classified_at", "is", null)
    .limit(200);

  if (!unlinkedSignals?.length) {
    return NextResponse.json({ results: [], timestamp: new Date().toISOString() });
  }

  const signalIds = unlinkedSignals.map((s) => s.id);
  const { data: linkedRows } = await supabase
    .from("work_object_signals")
    .select("signal_id")
    .in("signal_id", signalIds);

  const linkedIds = new Set(linkedRows?.map((r) => r.signal_id) ?? []);
  const usersWithUnlinked = new Set(
    unlinkedSignals.filter((s) => !linkedIds.has(s.id)).map((s) => s.user_id)
  );

  // Also include users who have active work objects eligible for extraction retry
  const { data: retryWOs } = await supabase
    .from("work_objects")
    .select("user_id")
    .eq("status", "active")
    .lt("extraction_attempts", 3)
    .is("extraction_failed_at", null);

  // Check which of these WOs actually lack activities
  if (retryWOs?.length) {
    const retryUserIds = [...new Set(retryWOs.map((wo) => wo.user_id))];
    for (const uid of retryUserIds) {
      usersWithUnlinked.add(uid);
    }
  }

  const uniqueUserIds = [...usersWithUnlinked];

  const results = [];
  for (const userId of uniqueUserIds) {
    try {
      const result = await runScoringEngine(userId);
      // Skip no-ops (user had no unclustered signals)
      if (result.clustered > 0 || result.activitiesCreated > 0 || result.errors > 0) {
        results.push({ userId, ...result });
      }
    } catch (err) {
      results.push({
        userId,
        clustered: 0,
        activitiesCreated: 0,
        errors: 1,
        error: err instanceof Error ? err.message : String(err),
        errorDetails: [],
      });
    }
  }

  return NextResponse.json({ results, timestamp: new Date().toISOString() });
}

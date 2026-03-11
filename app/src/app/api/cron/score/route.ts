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

  // Find users with classified signals (the scoring engine internally
  // filters to only unclustered signals, so this is just user discovery)
  const { data: classified } = await supabase
    .from("signals")
    .select("user_id")
    .not("classified_at", "is", null)
    .limit(100);

  const uniqueUserIds = [...new Set(classified?.map((s) => s.user_id) ?? [])];

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

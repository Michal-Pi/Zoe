import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { computeDailyMetrics } from "@/lib/metrics/compute-daily-metrics";

// Daily metrics computation — runs via Vercel Cron at 1am UTC.
// Computes yesterday's metrics for all active users.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceRoleClient();

  // Get unique user IDs from active connections
  const { data: connections, error } = await supabase
    .from("integration_connections")
    .select("user_id")
    .eq("status", "active");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Deduplicate user IDs
  const userIds = [...new Set((connections ?? []).map((c) => c.user_id))];

  // Compute metrics for yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const results = [];

  for (const userId of userIds) {
    try {
      const metrics = await computeDailyMetrics(userId, yesterday);

      const { error: upsertError } = await supabase
        .from("daily_metrics")
        .upsert(metrics, { onConflict: "user_id,date" });

      if (upsertError) {
        results.push({ userId, error: upsertError.message });
      } else {
        results.push({ userId, status: "ok" });
      }
    } catch (err) {
      results.push({
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    results,
    usersProcessed: userIds.length,
    timestamp: new Date().toISOString(),
  });
}

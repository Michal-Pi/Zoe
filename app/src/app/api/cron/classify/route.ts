import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { classifySignals } from "@/lib/signals/classifier";

// Runs every 2 minutes — classifies unclassified signals
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceRoleClient();

  // Find users with unclassified signals
  const { data: users } = await supabase
    .from("signals")
    .select("user_id")
    .is("classified_at", null)
    .limit(100);

  const uniqueUserIds = [...new Set(users?.map((u) => u.user_id) ?? [])];

  const results = [];
  for (const userId of uniqueUserIds) {
    try {
      const result = await classifySignals(userId);
      results.push({ userId, ...result });
    } catch (err) {
      results.push({
        userId,
        classified: 0,
        errors: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ results, timestamp: new Date().toISOString() });
}

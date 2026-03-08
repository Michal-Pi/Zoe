import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { generateDraftsForUser } from "@/lib/drafts/generate-draft";
import { generateFollowupsForUser } from "@/lib/drafts/generate-followup";

// Runs every 5 minutes — generates proactive draft replies and post-meeting follow-ups
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceRoleClient();

  // Find users with active Google connections (needed for draft generation)
  const { data: connections } = await supabase
    .from("integration_connections")
    .select("user_id, id")
    .eq("provider", "google")
    .eq("status", "active");

  if (!connections?.length) {
    return NextResponse.json({
      message: "No active Google connections",
      timestamp: new Date().toISOString(),
    });
  }

  const results = [];

  for (const conn of connections) {
    try {
      const [draftResult, followupResult] = await Promise.all([
        generateDraftsForUser(conn.user_id, conn.id),
        generateFollowupsForUser(conn.user_id),
      ]);

      results.push({
        userId: conn.user_id,
        drafts: draftResult,
        followups: followupResult,
      });
    } catch (err) {
      results.push({
        userId: conn.user_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ results, timestamp: new Date().toISOString() });
}

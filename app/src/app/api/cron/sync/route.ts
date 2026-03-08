import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { syncCalendarEvents } from "@/lib/integrations/google-calendar";
import { syncGmailMessages } from "@/lib/integrations/gmail";
import { classifyMeetings } from "@/lib/calendar/meeting-classifier";

// Periodic sync — runs via Vercel Cron every 5 minutes.
// Syncs Calendar + Gmail for all active Google connections.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceRoleClient();

  const { data: connections, error } = await supabase
    .from("integration_connections")
    .select("id, user_id")
    .eq("provider", "google")
    .eq("status", "active");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];

  for (const conn of connections ?? []) {
    const result: Record<string, unknown> = { userId: conn.user_id };
    try {
      const cal = await syncCalendarEvents(conn.user_id, conn.id);
      result.calendar = cal;
    } catch (err) {
      result.calendarError = err instanceof Error ? err.message : String(err);
    }
    try {
      const gmail = await syncGmailMessages(conn.user_id, conn.id, {
        daysBack: 2,
        maxMessages: 50,
      });
      result.gmail = gmail;
    } catch (err) {
      result.gmailError = err instanceof Error ? err.message : String(err);
    }
    try {
      const meetings = await classifyMeetings(conn.user_id);
      result.meetingClassification = meetings;
    } catch (err) {
      result.meetingClassificationError =
        err instanceof Error ? err.message : String(err);
    }
    results.push(result);
  }

  return NextResponse.json({ results, timestamp: new Date().toISOString() });
}

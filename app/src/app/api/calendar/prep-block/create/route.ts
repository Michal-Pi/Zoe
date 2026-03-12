import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createCalendarEvent,
  syncCalendarEvents,
} from "@/lib/integrations/google-calendar";

const createSchema = z.object({
  meetingId: z.string().uuid(),
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
});

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await request.json();
  const parsed = createSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { meetingId, start, end } = parsed.data;

  const [{ data: meeting }, { data: connection }] = await Promise.all([
    supabase
      .from("calendar_events")
      .select("id, title, start_at")
      .eq("id", meetingId)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("integration_connections")
      .select("id")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .eq("status", "active")
      .limit(1)
      .single(),
  ]);

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  if (!connection) {
    return NextResponse.json(
      { error: "No Google Calendar connection found" },
      { status: 400 }
    );
  }

  try {
    await createCalendarEvent(connection.id, {
      summary: `Prep: ${meeting.title}`,
      description: `Prep block created by Zoe before "${meeting.title}" (${meeting.start_at}).`,
      start,
      end,
    });

    await syncCalendarEvents(user.id, connection.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create prep block" },
      { status: 500 }
    );
  }
}

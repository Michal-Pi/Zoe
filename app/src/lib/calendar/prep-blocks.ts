import { createServiceRoleClient } from "@/lib/supabase/server";

export interface PrepSlot {
  start: string;
  end: string;
}

function combineDateAndTime(dateStr: string, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(`${dateStr}T00:00:00`);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export async function findPrepSlotsForMeeting(
  userId: string,
  meetingId: string,
  preferredDuration?: number
): Promise<{
  durationMinutes: number;
  meetingTitle: string;
  meetingStart: string;
  slots: PrepSlot[];
}> {
  const supabase = await createServiceRoleClient();

  const [{ data: meeting }, { data: profile }] = await Promise.all([
    supabase
      .from("calendar_events")
      .select(
        "id, title, start_at, prep_time_needed_minutes, has_prep_block, is_all_day"
      )
      .eq("id", meetingId)
      .eq("user_id", userId)
      .single(),
    supabase
      .from("profiles")
      .select("work_hours_start, work_hours_end, work_days")
      .eq("id", userId)
      .single(),
  ]);

  if (!meeting || meeting.is_all_day) {
    throw new Error("Meeting not found or not eligible for prep blocking");
  }

  const durationMinutes = Math.max(
    15,
    Math.min(preferredDuration ?? meeting.prep_time_needed_minutes ?? 15, 60)
  );

  const meetingStart = new Date(meeting.start_at);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const workStart = profile?.work_hours_start ?? "09:00";
  const workEnd = profile?.work_hours_end ?? "17:00";
  const workDays: number[] = profile?.work_days ?? [1, 2, 3, 4, 5];

  const { data: events } = await supabase
    .from("calendar_events")
    .select("start_at, end_at")
    .eq("user_id", userId)
    .eq("is_all_day", false)
    .gte("start_at", today.toISOString())
    .lte("end_at", meeting.start_at)
    .order("start_at");

  const busyIntervals = (events ?? []).map((event) => ({
    start: new Date(event.start_at).getTime(),
    end: new Date(event.end_at).getTime(),
  }));

  const bufferMs = 15 * 60 * 1000;
  const bufferedBusy = busyIntervals.map((interval) => ({
    start: interval.start - bufferMs,
    end: interval.end + bufferMs,
  }));

  const slots: PrepSlot[] = [];
  const durationMs = durationMinutes * 60 * 1000;

  for (
    const cursor = new Date(today);
    cursor <= meetingStart;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const day = new Date(cursor);
    day.setHours(0, 0, 0, 0);
    if (!workDays.includes(day.getDay())) continue;

    const dateStr = day.toISOString().split("T")[0];
    const dayStart = combineDateAndTime(dateStr, workStart).getTime();
    const dayEnd = combineDateAndTime(dateStr, workEnd).getTime();

    const windowStart = Math.max(dayStart, Date.now());
    let windowEnd = dayEnd;

    if (day.toDateString() === meetingStart.toDateString()) {
      windowEnd = Math.min(windowEnd, meetingStart.getTime());
    }

    if (windowStart >= windowEnd) continue;

    const dayBusy = bufferedBusy
      .filter((interval) => interval.end > windowStart && interval.start < windowEnd)
      .sort((a, b) => a.start - b.start);

    let freeStart = windowStart;
    const daySlots: PrepSlot[] = [];

    for (const busy of dayBusy) {
      if (freeStart < busy.start && busy.start - freeStart >= durationMs) {
        daySlots.push({
          start: new Date(busy.start - durationMs).toISOString(),
          end: new Date(busy.start).toISOString(),
        });
      }
      freeStart = Math.max(freeStart, busy.end);
    }

    if (windowEnd - freeStart >= durationMs) {
      daySlots.push({
        start: new Date(windowEnd - durationMs).toISOString(),
        end: new Date(windowEnd).toISOString(),
      });
    }

    daySlots.sort(
      (a, b) =>
        Math.abs(new Date(a.end).getTime() - meetingStart.getTime()) -
        Math.abs(new Date(b.end).getTime() - meetingStart.getTime())
    );

    for (const slot of daySlots) {
      slots.push(slot);
      if (slots.length >= 3) break;
    }

    if (slots.length >= 3) break;
  }

  return {
    durationMinutes,
    meetingTitle: meeting.title,
    meetingStart: meeting.start_at,
    slots,
  };
}

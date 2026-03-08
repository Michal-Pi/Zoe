import { createServiceRoleClient } from "@/lib/supabase/server";
import { startOfDay, endOfDay } from "date-fns";

interface CalendarEvent {
  start_at: string;
  end_at: string;
}

/**
 * Count deep work blocks: gaps >= 60 minutes between meetings during work hours.
 */
export function computeDeepWorkBlocks(
  events: CalendarEvent[],
  workHoursStart: number,
  workHoursEnd: number,
  date: Date
): number {
  const dayStart = new Date(date);
  dayStart.setHours(workHoursStart, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(workHoursEnd, 0, 0, 0);

  // Sort events by start time
  const sorted = [...events]
    .map((e) => ({
      start: Math.max(new Date(e.start_at).getTime(), dayStart.getTime()),
      end: Math.min(new Date(e.end_at).getTime(), dayEnd.getTime()),
    }))
    .filter((e) => e.start < e.end)
    .sort((a, b) => a.start - b.start);

  let blocks = 0;
  let cursor = dayStart.getTime();

  for (const event of sorted) {
    const gap = (event.start - cursor) / (1000 * 60);
    if (gap >= 60) blocks++;
    cursor = Math.max(cursor, event.end);
  }

  // Check gap after last meeting to end of work day
  const finalGap = (dayEnd.getTime() - cursor) / (1000 * 60);
  if (finalGap >= 60) blocks++;

  return blocks;
}

/**
 * Compute all daily metrics for a user on a given date.
 */
export async function computeDailyMetrics(
  userId: string,
  date: Date
): Promise<Record<string, unknown>> {
  const supabase = await createServiceRoleClient();
  const dayStart = startOfDay(date).toISOString();
  const dayEnd = endOfDay(date).toISOString();

  // Fetch calendar events
  const { data: events } = await supabase
    .from("calendar_events")
    .select("start_at, end_at")
    .eq("user_id", userId)
    .eq("is_all_day", false)
    .gte("start_at", dayStart)
    .lte("start_at", dayEnd);

  const calEvents = events ?? [];
  const meetingCount = calEvents.length;
  const totalMeetingMinutes = calEvents.reduce((sum, e) => {
    const start = new Date(e.start_at).getTime();
    const end = new Date(e.end_at).getTime();
    return sum + (end - start) / (1000 * 60);
  }, 0);

  // Fetch user profile for work hours
  const { data: profile } = await supabase
    .from("profiles")
    .select("work_hours_start, work_hours_end")
    .eq("id", userId)
    .single();

  const workStart = profile?.work_hours_start
    ? parseInt(profile.work_hours_start.split(":")[0], 10)
    : 9;
  const workEnd = profile?.work_hours_end
    ? parseInt(profile.work_hours_end.split(":")[0], 10)
    : 17;
  const totalWorkMinutes = (workEnd - workStart) * 60;
  const availableExecutionMinutes = Math.max(0, totalWorkMinutes - totalMeetingMinutes);

  const deepWorkBlocks = computeDeepWorkBlocks(calEvents, workStart, workEnd, date);

  // Signals counts for the day
  const { count: slackCount } = await supabase
    .from("signals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("source", "slack")
    .gte("received_at", dayStart)
    .lte("received_at", dayEnd);

  const { count: emailCount } = await supabase
    .from("signals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("source", "gmail")
    .eq("is_read", false)
    .gte("received_at", dayStart)
    .lte("received_at", dayEnd);

  // Activity stats
  const { data: completedActivities } = await supabase
    .from("activities")
    .select("score")
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("updated_at", dayStart)
    .lte("updated_at", dayEnd);

  const completed = completedActivities ?? [];
  const activitiesCompleted = completed.length;
  const avgActivityScore =
    activitiesCompleted > 0
      ? completed.reduce((sum, a) => sum + (a.score ?? 0), 0) / activitiesCompleted
      : null;

  // Reactive activity %: signals / (signals + completed activities)
  const totalSignals = (slackCount ?? 0) + (emailCount ?? 0);
  const totalActivity = totalSignals + activitiesCompleted;
  const reactiveActivityPct =
    totalActivity > 0
      ? Math.round((totalSignals / totalActivity) * 100 * 100) / 100
      : 0;

  return {
    user_id: userId,
    date: date.toISOString().split("T")[0],
    total_meeting_minutes: Math.round(totalMeetingMinutes),
    available_execution_minutes: Math.round(availableExecutionMinutes),
    meeting_count: meetingCount,
    active_slack_threads: slackCount ?? 0,
    unread_emails: emailCount ?? 0,
    open_loops: 0,
    reactive_activity_pct: reactiveActivityPct,
    deep_work_blocks: deepWorkBlocks,
    meetings_with_outcomes: 0, // Requires meeting outcome tracking
    meetings_prepared_on_time: 0,
    activities_completed: activitiesCompleted,
    activities_snoozed: 0,
    avg_activity_score: avgActivityScore,
    computed_at: new Date().toISOString(),
  };
}

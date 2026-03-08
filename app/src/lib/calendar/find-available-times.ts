import { createServiceRoleClient } from "@/lib/supabase/server";

export interface TimeSlot {
  start: string; // ISO timestamp
  end: string;
  day: string; // e.g., "Monday", "Tuesday"
}

export interface FindTimesOptions {
  durationMinutes: number;
  earliest: string; // ISO date string (YYYY-MM-DD)
  latest: string;
  preferredTime?: "morning" | "afternoon" | "any";
  avoidBackToBack?: boolean;
  bufferMinutes?: number;
}

interface BusyInterval {
  start: number; // epoch ms
  end: number;
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Find available time slots in the user's calendar.
 * Pure calendar math — no LLM needed.
 */
export async function findAvailableTimes(
  userId: string,
  options: FindTimesOptions
): Promise<{ slots: TimeSlot[]; timezone: string }> {
  const supabase = await createServiceRoleClient();

  // Fetch user profile for work hours + timezone
  const { data: profile } = await supabase
    .from("profiles")
    .select("work_hours_start, work_hours_end, work_days, timezone")
    .eq("id", userId)
    .single();

  const workStart = profile?.work_hours_start ?? "09:00";
  const workEnd = profile?.work_hours_end ?? "17:00";
  const workDays: number[] = profile?.work_days ?? [1, 2, 3, 4, 5];
  const timezone = profile?.timezone ?? "America/New_York";

  // Fetch calendar events in the date range
  const { data: events } = await supabase
    .from("calendar_events")
    .select("start_at, end_at")
    .eq("user_id", userId)
    .eq("is_all_day", false)
    .gte("start_at", `${options.earliest}T00:00:00`)
    .lte("end_at", `${options.latest}T23:59:59`)
    .order("start_at");

  const busyIntervals: BusyInterval[] = (events ?? []).map((e) => ({
    start: new Date(e.start_at).getTime(),
    end: new Date(e.end_at).getTime(),
  }));

  const buffer = options.avoidBackToBack !== false
    ? (options.bufferMinutes ?? 15) * 60 * 1000
    : 0;

  // Expand busy intervals by buffer
  const bufferedBusy = busyIntervals.map((b) => ({
    start: b.start - buffer,
    end: b.end + buffer,
  }));

  const slots: TimeSlot[] = [];
  const durationMs = options.durationMinutes * 60 * 1000;
  const now = Date.now();

  // Iterate each day in the range
  const startDate = new Date(options.earliest + "T00:00:00");
  const endDate = new Date(options.latest + "T23:59:59");

  for (
    let d = new Date(startDate);
    d <= endDate;
    d.setDate(d.getDate() + 1)
  ) {
    const dayOfWeek = d.getDay();
    if (!workDays.includes(dayOfWeek)) continue;

    const [startH, startM] = workStart.split(":").map(Number);
    const [endH, endM] = workEnd.split(":").map(Number);

    const dayStart = new Date(d);
    dayStart.setHours(startH, startM, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(endH, endM, 0, 0);

    // Don't consider times in the past
    const effectiveStart = Math.max(dayStart.getTime(), now);
    if (effectiveStart >= dayEnd.getTime()) continue;

    // Filter to apply time-of-day preference
    let windowStart = effectiveStart;
    let windowEnd = dayEnd.getTime();

    if (options.preferredTime === "morning") {
      const noon = new Date(d);
      noon.setHours(12, 0, 0, 0);
      windowEnd = Math.min(windowEnd, noon.getTime());
    } else if (options.preferredTime === "afternoon") {
      const noon = new Date(d);
      noon.setHours(12, 0, 0, 0);
      windowStart = Math.max(windowStart, noon.getTime());
    }

    if (windowStart >= windowEnd) continue;

    // Get busy intervals for this day
    const dayBusy = bufferedBusy
      .filter((b) => b.end > windowStart && b.start < windowEnd)
      .sort((a, b) => a.start - b.start);

    // Find free intervals
    const freeIntervals: BusyInterval[] = [];
    let cursor = windowStart;

    for (const busy of dayBusy) {
      if (cursor < busy.start) {
        freeIntervals.push({ start: cursor, end: busy.start });
      }
      cursor = Math.max(cursor, busy.end);
    }
    if (cursor < windowEnd) {
      freeIntervals.push({ start: cursor, end: windowEnd });
    }

    // Extract slots from free intervals
    for (const free of freeIntervals) {
      if (free.end - free.start >= durationMs) {
        // Take the earliest slot in this free block
        const slotStart = new Date(free.start);
        const slotEnd = new Date(free.start + durationMs);

        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          day: DAY_NAMES[slotStart.getDay()],
        });

        if (slots.length >= 5) break;
      }
    }

    if (slots.length >= 5) break;
  }

  return { slots, timezone };
}

/**
 * Pure function version for testing — takes events and profile directly.
 */
export function computeFreeSlots(
  events: Array<{ startAt: string; endAt: string }>,
  workStart: string,
  workEnd: string,
  workDays: number[],
  earliest: string,
  latest: string,
  durationMinutes: number,
  preferredTime: "morning" | "afternoon" | "any" = "any",
  bufferMinutes: number = 15,
  maxSlots: number = 5,
  nowMs?: number
): TimeSlot[] {
  const busyIntervals: BusyInterval[] = events.map((e) => ({
    start: new Date(e.startAt).getTime(),
    end: new Date(e.endAt).getTime(),
  }));

  const buffer = bufferMinutes * 60 * 1000;
  const bufferedBusy = busyIntervals.map((b) => ({
    start: b.start - buffer,
    end: b.end + buffer,
  }));

  const slots: TimeSlot[] = [];
  const durationMs = durationMinutes * 60 * 1000;
  const now = nowMs ?? Date.now();

  const startDate = new Date(earliest + "T00:00:00");
  const endDate = new Date(latest + "T23:59:59");

  for (
    let d = new Date(startDate);
    d <= endDate;
    d.setDate(d.getDate() + 1)
  ) {
    const dayOfWeek = d.getDay();
    if (!workDays.includes(dayOfWeek)) continue;

    const [startH, startM] = workStart.split(":").map(Number);
    const [endH, endM] = workEnd.split(":").map(Number);

    const dayStart = new Date(d);
    dayStart.setHours(startH, startM, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(endH, endM, 0, 0);

    const effectiveStart = Math.max(dayStart.getTime(), now);
    if (effectiveStart >= dayEnd.getTime()) continue;

    let windowStart = effectiveStart;
    let windowEnd = dayEnd.getTime();

    if (preferredTime === "morning") {
      const noon = new Date(d);
      noon.setHours(12, 0, 0, 0);
      windowEnd = Math.min(windowEnd, noon.getTime());
    } else if (preferredTime === "afternoon") {
      const noon = new Date(d);
      noon.setHours(12, 0, 0, 0);
      windowStart = Math.max(windowStart, noon.getTime());
    }

    if (windowStart >= windowEnd) continue;

    const dayBusy = bufferedBusy
      .filter((b) => b.end > windowStart && b.start < windowEnd)
      .sort((a, b) => a.start - b.start);

    const freeIntervals: BusyInterval[] = [];
    let cursor = windowStart;

    for (const busy of dayBusy) {
      if (cursor < busy.start) {
        freeIntervals.push({ start: cursor, end: busy.start });
      }
      cursor = Math.max(cursor, busy.end);
    }
    if (cursor < windowEnd) {
      freeIntervals.push({ start: cursor, end: windowEnd });
    }

    for (const free of freeIntervals) {
      if (free.end - free.start >= durationMs) {
        const slotStart = new Date(free.start);
        const slotEnd = new Date(free.start + durationMs);

        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          day: DAY_NAMES[slotStart.getDay()],
        });

        if (slots.length >= maxSlots) return slots;
      }
    }
  }

  return slots;
}

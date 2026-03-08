"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { CalendarEvent } from "@/domain/calendar";

function mapRow(row: Record<string, unknown>): CalendarEvent {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    externalId: row.external_id as string,
    connectionId: row.connection_id as string | null,
    title: row.title as string,
    description: row.description as string | null,
    location: row.location as string | null,
    startAt: row.start_at as string,
    endAt: row.end_at as string,
    isAllDay: row.is_all_day as boolean,
    isRecurring: row.is_recurring as boolean,
    recurrenceRule: row.recurrence_rule as string | null,
    organizerEmail: row.organizer_email as string | null,
    isOrganizer: row.is_organizer as boolean,
    attendees: row.attendees as CalendarEvent["attendees"],
    attendeeCount: row.attendee_count as number,
    decisionDensity: row.decision_density as CalendarEvent["decisionDensity"],
    ownershipLoad: row.ownership_load as CalendarEvent["ownershipLoad"],
    efficiencyRisks: row.efficiency_risks as string[] | null,
    prepTimeNeededMinutes: row.prep_time_needed_minutes as number | null,
    hasPrepBlock: row.has_prep_block as boolean,
    syncedAt: row.synced_at as string,
  };
}

export function useCalendarEvents(date: Date) {
  const supabase = createClient();

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  return useQuery({
    queryKey: ["calendar-events", dayStart.toISOString()],
    queryFn: async (): Promise<CalendarEvent[]> => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("start_at", dayStart.toISOString())
        .lte("start_at", dayEnd.toISOString())
        .order("start_at");

      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
  });
}

export function useCalendarStats(date: Date) {
  const supabase = createClient();

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  return useQuery({
    queryKey: ["calendar-stats", dayStart.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("start_at, end_at, decision_density, is_all_day, has_prep_block, efficiency_risks")
        .gte("start_at", dayStart.toISOString())
        .lte("start_at", dayEnd.toISOString())
        .eq("is_all_day", false);

      if (error) throw error;
      const events = data ?? [];

      interface CalendarRow {
        start_at: string;
        end_at: string;
        decision_density: string | null;
        is_all_day: boolean;
        has_prep_block: boolean;
        efficiency_risks: string[] | null;
      }
      const totalMeetings = events.length;
      const totalMinutes = events.reduce((sum: number, e: CalendarRow) => {
        const start = new Date(e.start_at).getTime();
        const end = new Date(e.end_at).getTime();
        return sum + (end - start) / 60000;
      }, 0);
      const highDensity = events.filter(
        (e: CalendarRow) => e.decision_density === "high"
      ).length;
      const needsPrep = events.filter(
        (e: CalendarRow) => !e.has_prep_block && (e.decision_density === "high" || e.decision_density === "medium")
      ).length;
      const riskCount = events.reduce(
        (sum: number, e: CalendarRow) => sum + (e.efficiency_risks?.length ?? 0),
        0
      );

      return {
        totalMeetings,
        totalMinutes: Math.round(totalMinutes),
        highDensity,
        needsPrep,
        riskCount,
      };
    },
  });
}

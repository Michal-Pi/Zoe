"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  getGreeting,
  computeMaxTasks,
  generateInterventions,
} from "@/lib/dashboard";
import type {
  DashboardData,
  RealityBrief,
  BehavioralSnapshot,
  TrendDirection,
} from "@/domain/dashboard";
import {
  generateBehavioralSuggestions,
  type BehavioralSuggestion,
} from "@/lib/metrics/behavioral-suggestions";
import { startOfDay, endOfDay } from "date-fns";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard", new Date().toDateString()],
    queryFn: async (): Promise<DashboardData> => {
      const supabase = createClient();
      const today = new Date();
      const dayStart = startOfDay(today).toISOString();
      const dayEnd = endOfDay(today).toISOString();

      // Fetch today's calendar events
      const { data: events } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("start_at", dayStart)
        .lte("start_at", dayEnd)
        .eq("is_all_day", false);

      // Fetch user profile for work hours
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("work_hours_start, work_hours_end, timezone")
        .eq("id", user.id)
        .single();

      // Calculate metrics
      const totalMeetingMinutes = (events ?? []).reduce((sum: number, event: { start_at: string; end_at: string }) => {
        const start = new Date(event.start_at).getTime();
        const end = new Date(event.end_at).getTime();
        return sum + (end - start) / (1000 * 60);
      }, 0);

      // Available execution time = work hours - meeting time
      const workHoursStart = profile?.work_hours_start ?? "09:00";
      const workHoursEnd = profile?.work_hours_end ?? "17:00";
      const parseTime = (t: string) => {
        const parts = t.split(":").map(Number);
        return { h: parts[0] || 0, m: parts[1] || 0 };
      };
      const start = parseTime(workHoursStart);
      const end = parseTime(workHoursEnd);
      const totalWorkMinutes = (end.h - start.h) * 60 + (end.m - start.m);
      const availableExecutionMinutes = Math.max(
        0,
        totalWorkMinutes - totalMeetingMinutes
      );

      // Fetch signal counts in parallel
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      const [
        { count: activeSlackThreads },
        { count: unreadEmails },
        { count: openLoops },
      ] = await Promise.all([
        supabase
          .from("signals")
          .select("*", { count: "exact", head: true })
          .eq("source", "slack")
          .not("thread_id", "is", null)
          .gte("received_at", fortyEightHoursAgo),
        supabase
          .from("signals")
          .select("*", { count: "exact", head: true })
          .eq("source", "gmail")
          .eq("is_read", false),
        supabase
          .from("signals")
          .select("*", { count: "exact", head: true })
          .eq("requires_response", true)
          .lt("received_at", fortyEightHoursAgo),
      ]);

      const realityBrief: RealityBrief = {
        availableExecutionMinutes: Math.round(availableExecutionMinutes),
        totalMeetingMinutes: Math.round(totalMeetingMinutes),
        meetingCount: events?.length ?? 0,
        activeSlackThreads: activeSlackThreads ?? 0,
        unreadEmails: unreadEmails ?? 0,
        openLoops: openLoops ?? 0,
        maxMeaningfulTasks: computeMaxTasks(availableExecutionMinutes),
      };

      // Behavioral snapshot — fetch 14 days for trend comparison
      const { data: metrics } = await supabase
        .from("daily_metrics")
        .select("*")
        .order("date", { ascending: false })
        .limit(14);

      interface MetricRow {
        reactive_activity_pct?: number;
        deep_work_blocks?: number;
        meetings_with_outcomes?: number;
        meeting_count?: number;
        meetings_prepared_on_time?: number;
        activities_completed?: number;
      }
      let behavioralSnapshot: BehavioralSnapshot | null = null;
      let suggestions: BehavioralSuggestion[] = [];
      if (metrics && metrics.length >= 3) {
        // Split into current (first 7) and previous (next 7) windows
        const current = metrics.slice(0, 7) as MetricRow[];
        const previous = metrics.slice(7) as MetricRow[];

        const avg = (rows: MetricRow[], key: keyof MetricRow) =>
          rows.length > 0
            ? rows.reduce((sum, m) => sum + ((m[key] as number) ?? 0), 0) / rows.length
            : 0;

        const computeTrend = (
          currentAvg: number,
          previousAvg: number,
          lowerIsBetter: boolean
        ): TrendDirection => {
          if (previous.length === 0) return "stable";
          const threshold = 0.1; // 10% change threshold
          const pctChange = previousAvg === 0
            ? (currentAvg > 0 ? 1 : 0)
            : (currentAvg - previousAvg) / previousAvg;
          if (Math.abs(pctChange) < threshold) return "stable";
          const isGoingUp = pctChange > 0;
          return (isGoingUp === lowerIsBetter) ? "worsening" : "improving";
        };

        const avgReactive = avg(current, "reactive_activity_pct");
        const totalDeepWork = current.reduce(
          (sum: number, m: MetricRow) => sum + (m.deep_work_blocks ?? 0), 0
        );
        const totalMeetingsWithOutcomes = current.reduce(
          (sum: number, m: MetricRow) => sum + (m.meetings_with_outcomes ?? 0), 0
        );
        const totalMeetings = current.reduce(
          (sum: number, m: MetricRow) => sum + (m.meeting_count ?? 0), 0
        );
        const totalPrepared = current.reduce(
          (sum: number, m: MetricRow) => sum + (m.meetings_prepared_on_time ?? 0), 0
        );
        const totalCompleted = current.reduce(
          (sum: number, m: MetricRow) => sum + (m.activities_completed ?? 0), 0
        );

        behavioralSnapshot = {
          reactiveActivityPct: avgReactive,
          deepWorkBlocks: totalDeepWork,
          meetingsWithOutcomes: totalMeetingsWithOutcomes,
          meetingsTotal: totalMeetings,
          meetingsPreparedOnTime: totalPrepared,
          periodLabel: `Last ${current.length} days`,
          reactiveActivityTrend: computeTrend(
            avgReactive, avg(previous, "reactive_activity_pct"), true
          ),
          deepWorkTrend: computeTrend(
            avg(current, "deep_work_blocks"), avg(previous, "deep_work_blocks"), false
          ),
        };

        suggestions = generateBehavioralSuggestions({
          reactiveActivityPct: avgReactive,
          deepWorkBlocks: totalDeepWork,
          meetingsWithOutcomes: totalMeetingsWithOutcomes,
          meetingsTotal: totalMeetings,
          activitiesCompleted: totalCompleted,
        });
      }

      return {
        realityBrief,
        behavioralSnapshot,
        interventions: generateInterventions(realityBrief),
        suggestions,
        greeting: getGreeting(),
      };
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60_000,
  });
}

"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MeetingCard } from "@/components/calendar/meeting-card";
import { CalendarStats } from "@/components/calendar/calendar-stats";
import { DayNav } from "@/components/calendar/day-nav";
import { useCalendarEvents, useCalendarStats } from "@/hooks/use-calendar";
import { cn } from "@/lib/utils";

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"risk" | "timeline">("risk");
  const { data: events, isLoading: eventsLoading, isError } =
    useCalendarEvents(selectedDate);
  const { data: stats, isLoading: statsLoading } =
    useCalendarStats(selectedDate);

  const prioritizedEvents = [...(events ?? [])].sort((a, b) => {
    const aPrepRisk =
      (!a.hasPrepBlock && (a.prepTimeNeededMinutes ?? 0) > 0 ? 3 : 0) +
      (a.decisionDensity === "high" ? 3 : a.decisionDensity === "medium" ? 2 : 0) +
      (a.efficiencyRisks?.length ?? 0);
    const bPrepRisk =
      (!b.hasPrepBlock && (b.prepTimeNeededMinutes ?? 0) > 0 ? 3 : 0) +
      (b.decisionDensity === "high" ? 3 : b.decisionDensity === "medium" ? 2 : 0) +
      (b.efficiencyRisks?.length ?? 0);

    if (viewMode === "risk" && bPrepRisk !== aPrepRisk) {
      return bPrepRisk - aPrepRisk;
    }

    return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
  });

  const isToday =
    selectedDate.toDateString() === new Date().toDateString();
  const needsPrepCount = stats?.needsPrep ?? 0;
  const showPrepBanner = isToday && needsPrepCount > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Calendar Intelligence
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your meetings analyzed for decision density, prep status, and
            efficiency.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <DayNav date={selectedDate} onDateChange={setSelectedDate} />
          <div className="inline-flex rounded-lg border border-border bg-card p-1">
            <button
              type="button"
              onClick={() => setViewMode("risk")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "risk"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              Needs prep first
            </button>
            <button
              type="button"
              onClick={() => setViewMode("timeline")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "timeline"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              Timeline
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <CalendarStats
        totalMeetings={stats?.totalMeetings ?? 0}
        totalMinutes={stats?.totalMinutes ?? 0}
        highDensity={stats?.highDensity ?? 0}
        needsPrep={stats?.needsPrep ?? 0}
        riskCount={stats?.riskCount ?? 0}
        isLoading={statsLoading}
      />

      {showPrepBanner ? (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-display text-lg font-medium text-foreground">
                {needsPrepCount} meeting{needsPrepCount === 1 ? "" : "s"} need prep today
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Use the prep-first view to handle the risky meetings before the day gets away from you.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setViewMode("risk")}
              className="border-destructive/30 bg-background"
            >
              Show risky meetings first
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Meeting list */}
      {isError ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load calendar events. Please try refreshing.
        </div>
      ) : eventsLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : events?.length ? (
        <div className="space-y-2">
          {prioritizedEvents.map((event) => (
            <MeetingCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <div className="text-center">
              <p className="font-display text-lg font-medium text-foreground">
                No meetings
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {selectedDate.toDateString() === new Date().toDateString()
                  ? "Connect Google Calendar to see meeting intelligence."
                  : "No meetings scheduled for this day."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

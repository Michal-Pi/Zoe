"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MeetingCard } from "@/components/calendar/meeting-card";
import { CalendarStats } from "@/components/calendar/calendar-stats";
import { DayNav } from "@/components/calendar/day-nav";
import { useCalendarEvents, useCalendarStats } from "@/hooks/use-calendar";

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { data: events, isLoading: eventsLoading, isError } =
    useCalendarEvents(selectedDate);
  const { data: stats, isLoading: statsLoading } =
    useCalendarStats(selectedDate);

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
        <DayNav date={selectedDate} onDateChange={setSelectedDate} />
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
          {events.map((event) => (
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

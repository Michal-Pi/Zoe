"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CalendarEvent } from "@/domain/calendar";
import { useCalendarEvents } from "@/hooks/use-calendar";
import { PrepBlockAction } from "@/components/calendar/prep-block-action";
import { MeetingBriefAction } from "@/components/calendar/meeting-brief-action";

const riskLabels: Record<string, string> = {
  no_agenda: "No agenda",
  back_to_back: "Back-to-back",
  recurring_stale: "Stale recurring",
  too_many_attendees: "Too many attendees",
  no_prep_time: "No prep time",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getMeetingRiskScore(event: CalendarEvent): number {
  let score = 0;

  if (event.decisionDensity === "high") score += 4;
  if (event.decisionDensity === "medium") score += 2;

  if (event.ownershipLoad === "organizer" || event.ownershipLoad === "presenter") {
    score += 3;
  } else if (event.ownershipLoad === "contributor") {
    score += 2;
  }

  if ((event.prepTimeNeededMinutes ?? 0) > 0 && !event.hasPrepBlock) {
    score += 4;
  }

  score += event.efficiencyRisks?.length ?? 0;

  return score;
}

function getRiskReasons(event: CalendarEvent): string[] {
  const reasons = new Set<string>();

  if ((event.prepTimeNeededMinutes ?? 0) > 0 && !event.hasPrepBlock) {
    reasons.add(`No ${event.prepTimeNeededMinutes}m prep block`);
  }

  if (event.decisionDensity === "high") {
    reasons.add("High decision density");
  }

  if (event.ownershipLoad === "organizer" || event.ownershipLoad === "presenter") {
    reasons.add(
      event.ownershipLoad === "organizer" ? "You are driving this meeting" : "You are expected to present"
    );
  }

  for (const risk of event.efficiencyRisks ?? []) {
    reasons.add(riskLabels[risk] ?? risk);
  }

  return Array.from(reasons).slice(0, 3);
}

export function MeetingsAtRiskSection({ hasCalendar }: { hasCalendar: boolean }) {
  const { data: events, isLoading, isError } = useCalendarEvents(new Date());
  const now = new Date();

  const riskyMeetings = (events ?? [])
    .filter(
      (event) =>
        !event.isAllDay &&
        new Date(event.endAt) > now &&
        getMeetingRiskScore(event) >= 4
    )
    .sort((a, b) => {
      const scoreDiff = getMeetingRiskScore(b) - getMeetingRiskScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
    })
    .slice(0, 3);

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Meetings At Risk Today
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Prep risk is surfaced before the meeting becomes reactive damage control.
          </p>
        </div>
        {hasCalendar ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/calendar">Open calendar</Link>
          </Button>
        ) : null}
      </div>

      {!hasCalendar ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            Connect Google Calendar to see which meetings need prep before they start.
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="py-10 text-sm text-destructive">
            Failed to load meeting prep risk. Refresh and try again.
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-40 rounded-lg border border-border bg-card animate-pulse"
            />
          ))}
        </div>
      ) : riskyMeetings.length ? (
        <div className="grid gap-3 xl:grid-cols-3">
          {riskyMeetings.map((event) => {
            const reasons = getRiskReasons(event);

            return (
              <Card key={event.id} className="border-destructive/20 shadow-sm">
                <CardContent className="space-y-4 p-5">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-destructive">
                      Starts {formatTime(event.startAt)}
                    </p>
                    <h3 className="font-display text-lg font-medium text-foreground">
                      {event.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {event.decisionDensity ?? "unknown"} density
                      {event.ownershipLoad ? ` · ${event.ownershipLoad}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {reasons.map((reason) => (
                      <span
                        key={reason}
                        className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <MeetingBriefAction event={event} label="Prep me" />
                    <PrepBlockAction event={event} label="Block prep time" />
                    <Button asChild size="sm" variant="outline">
                      <Link href="/calendar">Review calendar</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            No meetings currently look underprepared. Zoe will flag the next one that needs work.
          </CardContent>
        </Card>
      )}
    </section>
  );
}

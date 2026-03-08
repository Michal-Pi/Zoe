"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CalendarEvent } from "@/domain/calendar";

interface MeetingCardProps {
  event: CalendarEvent;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getDurationMinutes(start: string, end: string): number {
  return Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 60000
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getDensityColor(density: CalendarEvent["decisionDensity"]): string {
  switch (density) {
    case "high":
      return "bg-score-high/10 text-score-high";
    case "medium":
      return "bg-score-medium/10 text-score-medium";
    case "low":
      return "bg-score-low/10 text-score-low";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getOwnershipLabel(load: CalendarEvent["ownershipLoad"]): string {
  switch (load) {
    case "organizer":
      return "Organizer";
    case "presenter":
      return "Presenter";
    case "contributor":
      return "Contributor";
    case "passive":
      return "Passive";
    default:
      return "";
  }
}

const riskLabels: Record<string, string> = {
  no_agenda: "No agenda",
  back_to_back: "Back-to-back",
  recurring_stale: "Stale recurring",
  too_many_attendees: "Too many attendees",
  no_prep_time: "No prep time",
};

export function MeetingCard({ event }: MeetingCardProps) {
  const duration = getDurationMinutes(event.startAt, event.endAt);
  const hasRisks = event.efficiencyRisks && event.efficiencyRisks.length > 0;

  return (
    <Card
      className={cn(
        "transition-all duration-200 hover:shadow-md",
        hasRisks && "border-destructive/20"
      )}
    >
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Time column */}
          <div className="w-16 shrink-0 text-right">
            <p className="font-mono text-sm font-medium text-foreground">
              {event.isAllDay ? "All day" : formatTime(event.startAt)}
            </p>
            {!event.isAllDay && (
              <p className="font-mono text-xs text-muted-foreground">
                {formatDuration(duration)}
              </p>
            )}
          </div>

          {/* Density indicator bar */}
          <div
            className={cn(
              "w-1 shrink-0 rounded-full",
              event.decisionDensity === "high"
                ? "bg-score-high"
                : event.decisionDensity === "medium"
                  ? "bg-score-medium"
                  : "bg-border"
            )}
          />

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-medium text-foreground">
                {event.title}
              </h3>
              {event.attendeeCount > 0 && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {event.attendeeCount}{" "}
                  {event.attendeeCount === 1 ? "person" : "people"}
                </span>
              )}
            </div>

            {event.location && (
              <p className="mt-0.5 text-xs text-muted-foreground truncate">
                {event.location}
              </p>
            )}

            {/* Tags */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {event.decisionDensity && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-xs font-normal",
                    getDensityColor(event.decisionDensity)
                  )}
                >
                  {event.decisionDensity} density
                </Badge>
              )}

              {event.ownershipLoad && (
                <Badge variant="secondary" className="text-xs font-normal">
                  {getOwnershipLabel(event.ownershipLoad)}
                </Badge>
              )}

              {event.isRecurring && (
                <Badge
                  variant="secondary"
                  className="text-xs font-normal bg-surface-tertiary"
                >
                  Recurring
                </Badge>
              )}

              {event.prepTimeNeededMinutes != null &&
                event.prepTimeNeededMinutes > 0 && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs font-normal",
                      event.hasPrepBlock
                        ? "bg-score-low/10 text-score-low"
                        : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {event.hasPrepBlock ? "Prep ready" : `Need ${event.prepTimeNeededMinutes}m prep`}
                  </Badge>
                )}
            </div>

            {/* Risk flags */}
            {hasRisks && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {event.efficiencyRisks!.map((risk) => (
                  <span
                    key={risk}
                    className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
                  >
                    {riskLabels[risk] ?? risk}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

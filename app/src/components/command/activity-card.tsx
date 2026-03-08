"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Activity } from "@/domain/signals";

interface ActivityCardProps {
  activity: Activity;
  variant?: "dominant" | "default";
  hasDraft?: boolean;
  onComplete: (id: string) => void;
  onSnooze: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onStart: (id: string) => void;
  onAskZoe: (id: string) => void;
  onViewDraft?: (id: string) => void;
}

function getScoreColor(score: number): string {
  if (score >= 70) return "text-score-high";
  if (score >= 40) return "text-score-medium";
  return "text-score-low";
}

function getScoreBg(score: number): string {
  if (score >= 70) return "bg-score-high/10";
  if (score >= 40) return "bg-score-medium/10";
  return "bg-score-low/10";
}

function getHorizonLabel(horizon: Activity["horizon"]): string {
  switch (horizon) {
    case "now":
      return "Now";
    case "soon":
      return "This week";
    case "strategic":
      return "Strategic";
  }
}

function getHorizonColor(horizon: Activity["horizon"]): string {
  switch (horizon) {
    case "now":
      return "bg-score-high/10 text-score-high";
    case "soon":
      return "bg-score-medium/10 text-score-medium";
    case "strategic":
      return "bg-primary/10 text-primary";
  }
}

function formatTime(minutes: number | null): string {
  if (minutes == null) return "";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function ActivityCard({
  activity,
  variant = "default",
  hasDraft,
  onComplete,
  onSnooze,
  onPin,
  onStart,
  onAskZoe,
  onViewDraft,
}: ActivityCardProps) {
  const isDominant = variant === "dominant";

  return (
    <Card
      className={cn(
        "transition-all duration-200 hover:shadow-md",
        isDominant && "border-primary/30 shadow-md",
        activity.isPinned && "border-primary/20"
      )}
    >
      <CardContent className={cn("p-4", isDominant && "p-6")}>
        <div className="flex items-start gap-3">
          {/* Score badge */}
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-bold",
              getScoreBg(activity.score),
              getScoreColor(activity.score)
            )}
          >
            {activity.score}
          </div>

          <div className="min-w-0 flex-1">
            {/* Title row */}
            <div className="flex items-start justify-between gap-2">
              <h3
                className={cn(
                  "font-medium text-foreground",
                  isDominant
                    ? "font-display text-lg"
                    : "text-sm"
                )}
              >
                {activity.isPinned && (
                  <span className="mr-1.5 text-primary" aria-hidden="true">&#9679;</span>
                )}
                {activity.title}
              </h3>

              {activity.timeEstimateMinutes && (
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {formatTime(activity.timeEstimateMinutes)}
                </span>
              )}
            </div>

            {/* Description */}
            {activity.description && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {activity.description}
              </p>
            )}

            {/* Tags row */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs font-normal",
                  getHorizonColor(activity.horizon)
                )}
              >
                {getHorizonLabel(activity.horizon)}
              </Badge>

              {activity.batchLabel && (
                <Badge
                  variant="secondary"
                  className="text-xs font-normal bg-surface-tertiary"
                >
                  {activity.batchLabel}
                </Badge>
              )}

              {activity.deadlineAt && (
                <Badge
                  variant="secondary"
                  className="text-xs font-normal bg-destructive/10 text-destructive"
                >
                  Due{" "}
                  {new Date(activity.deadlineAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </Badge>
              )}

              {hasDraft && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer text-xs font-normal bg-primary/10 text-primary hover:bg-primary/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDraft?.(activity.id);
                  }}
                >
                  Draft ready
                </Badge>
              )}
            </div>

            {/* Rationale */}
            {isDominant && activity.scoreRationale?.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {activity.scoreRationale.map((reason, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            ) : null}

            {/* Actions */}
            <div className="mt-3 flex items-center gap-2">
              {activity.status === "pending" ? (
                <Button
                  size="sm"
                  variant={isDominant ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => onStart(activity.id)}
                >
                  Start
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs"
                  onClick={() => onComplete(activity.id)}
                >
                  Complete
                </Button>
              )}

              {isDominant && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-primary border-primary/30"
                  onClick={() => onAskZoe(activity.id)}
                >
                  Ask Zoe
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => onSnooze(activity.id)}
              >
                Snooze
              </Button>

              {!isDominant && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-primary"
                  onClick={() => onAskZoe(activity.id)}
                >
                  Ask Zoe
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground"
                onClick={() => onPin(activity.id, !activity.isPinned)}
                title={activity.isPinned ? "Unpin" : "Pin"}
              >
                <PinIcon
                  className={cn(
                    "h-3.5 w-3.5",
                    activity.isPinned && "text-primary"
                  )}
                />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.5 2.5L13.5 6.5L11 9L11.5 13.5L8 10L4.5 13.5L5 9L2.5 6.5L6.5 2.5L9.5 2.5Z" />
    </svg>
  );
}

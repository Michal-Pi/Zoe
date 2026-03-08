"use client";

import { ActivityCard } from "./activity-card";
import type { Activity } from "@/domain/signals";

interface ActivityListProps {
  activities: Activity[];
  onComplete: (id: string) => void;
  onSnooze: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onStart: (id: string) => void;
  onAskZoe: (id: string) => void;
}

export function ActivityList({
  activities,
  onComplete,
  onSnooze,
  onPin,
  onStart,
  onAskZoe,
}: ActivityListProps) {
  if (!activities.length) return null;

  // Split: first item is dominant, rest are regular
  const [dominant, ...rest] = activities;

  // Group remaining by horizon
  const now = rest.filter((a) => a.horizon === "now");
  const soon = rest.filter((a) => a.horizon === "soon");
  const strategic = rest.filter((a) => a.horizon === "strategic");

  return (
    <div className="space-y-6">
      {/* Dominant action */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Top Priority
        </p>
        <ActivityCard
          activity={dominant}
          variant="dominant"
          onComplete={onComplete}
          onSnooze={onSnooze}
          onPin={onPin}
          onStart={onStart}
          onAskZoe={onAskZoe}
        />
      </div>

      {/* Now section */}
      {now.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Needs attention today ({now.length})
          </p>
          <div className="space-y-2">
            {now.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                onComplete={onComplete}
                onSnooze={onSnooze}
                onPin={onPin}
                onStart={onStart}
                onAskZoe={onAskZoe}
              />
            ))}
          </div>
        </div>
      )}

      {/* Soon section */}
      {soon.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            This week ({soon.length})
          </p>
          <div className="space-y-2">
            {soon.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                onComplete={onComplete}
                onSnooze={onSnooze}
                onPin={onPin}
                onStart={onStart}
                onAskZoe={onAskZoe}
              />
            ))}
          </div>
        </div>
      )}

      {/* Strategic section */}
      {strategic.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Strategic ({strategic.length})
          </p>
          <div className="space-y-2">
            {strategic.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                onComplete={onComplete}
                onSnooze={onSnooze}
                onPin={onPin}
                onStart={onStart}
                onAskZoe={onAskZoe}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

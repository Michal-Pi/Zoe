"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ActivityList } from "@/components/command/activity-list";
import { SignalStatsBar } from "@/components/command/signal-stats-bar";
import { useActivities, useUpdateActivity } from "@/hooks/use-activities";
import { useSignalStats } from "@/hooks/use-signals";

function getSnoozeOptions() {
  const laterToday = new Date();
  laterToday.setHours(laterToday.getHours() + 2);

  const tomorrowMorning = new Date();
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
  tomorrowMorning.setHours(9, 0, 0, 0);

  const nextMonday = new Date();
  const dayOfWeek = nextMonday.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
  nextMonday.setHours(9, 0, 0, 0);

  return [
    { label: "Later today (+2 hours)", date: laterToday },
    { label: "Tomorrow morning (9 AM)", date: tomorrowMorning },
    { label: "Next Monday (9 AM)", date: nextMonday },
  ] as const;
}

function SnoozePicker({
  open,
  onClose,
  onSnooze,
}: {
  open: boolean;
  onClose: () => void;
  onSnooze: (date: Date) => void;
}) {
  const [customDate, setCustomDate] = useState("");
  const snoozeOptions = getSnoozeOptions();

  const handleQuickSnooze = (date: Date) => {
    onSnooze(date);
    onClose();
  };

  const handleCustomSnooze = () => {
    if (!customDate) return;
    onSnooze(new Date(customDate));
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Snooze until...</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {snoozeOptions.map((option) => (
            <Button
              key={option.label}
              variant="outline"
              className="w-full justify-start text-sm"
              onClick={() => handleQuickSnooze(option.date)}
            >
              {option.label}
            </Button>
          ))}

          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Custom date &amp; time
            </p>
            <input
              type="datetime-local"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
            />
            <Button
              size="sm"
              className="mt-2 w-full text-xs"
              disabled={!customDate}
              onClick={handleCustomSnooze}
            >
              Snooze
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CommandPage() {
  const { data: activities, isLoading: activitiesLoading, isError } = useActivities();
  const { data: stats, isLoading: statsLoading } = useSignalStats();
  const updateActivity = useUpdateActivity();
  const router = useRouter();
  const [snoozeTarget, setSnoozeTarget] = useState<string | null>(null);

  const handleComplete = (id: string) => {
    updateActivity.mutate({
      id,
      updates: {
        status: "completed",
      },
    });
  };

  const handleSnooze = (id: string) => {
    setSnoozeTarget(id);
  };

  const handleSnoozeConfirm = (date: Date) => {
    if (!snoozeTarget) return;
    updateActivity.mutate({
      id: snoozeTarget,
      updates: {
        status: "snoozed",
        snoozed_until: date.toISOString(),
      },
    });
    setSnoozeTarget(null);
  };

  const handlePin = (id: string, pinned: boolean) => {
    updateActivity.mutate({
      id,
      updates: { is_pinned: pinned },
    });
  };

  const handleStart = (id: string) => {
    updateActivity.mutate({
      id,
      updates: { status: "in_progress" },
    });
  };

  const handleAskZoe = (activityId: string) => {
    router.push(`/chat?context=activity&id=${activityId}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">
          Command Center
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your highest-priority actions, ranked and ready.
        </p>
      </div>

      {/* Signal stats bar */}
      <SignalStatsBar
        totalToday={stats?.totalToday ?? 0}
        unclassified={stats?.unclassified ?? 0}
        needsResponse={stats?.needsResponse ?? 0}
        isLoading={statsLoading}
      />

      {/* Activities */}
      {isError ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load activities. Please try refreshing.
        </div>
      ) : activitiesLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : activities?.length ? (
        <ActivityList
          activities={activities}
          onComplete={handleComplete}
          onSnooze={handleSnooze}
          onPin={handlePin}
          onStart={handleStart}
          onAskZoe={handleAskZoe}
        />
      ) : (
        <Card className="border-primary/20 shadow-md">
          <CardContent className="flex items-center justify-center py-16">
            <div className="text-center">
              <p className="font-display text-lg font-medium text-foreground">
                No activities yet
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Connect your email and Slack to start seeing prioritized
                actions.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Snooze picker dialog */}
      <SnoozePicker
        open={snoozeTarget !== null}
        onClose={() => setSnoozeTarget(null)}
        onSnooze={handleSnoozeConfirm}
      />
    </div>
  );
}

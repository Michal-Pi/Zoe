"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { useHasConnection } from "@/hooks/use-connections";
import { withBasePath } from "@/lib/base-path";

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

function ProcessingStatusCard({
  totalSignals,
  unclassified,
  needsResponse,
  readyActivities,
  isProcessingNow,
  onProcessNow,
}: {
  totalSignals: number;
  unclassified: number;
  needsResponse: number;
  readyActivities: number;
  isProcessingNow: boolean;
  onProcessNow: () => void;
}) {
  const processedSignals = Math.max(totalSignals - unclassified, 0);
  const processedPercent =
    totalSignals > 0 ? Math.min(100, Math.round((processedSignals / totalSignals) * 100)) : 0;

  let title = "Building your action list";
  let description =
    "Zoe is classifying your signals and extracting the next actions that matter.";

  if (isProcessingNow) {
    title = "Processing your work now";
    description = "Running classification and scoring for your account.";
  } else if (unclassified === 0 && needsResponse > 0 && readyActivities === 0) {
    title = `Detected ${needsResponse} actionable signals`;
    description =
      "Classification is complete, but activity extraction has not produced tasks yet. Run processing again to retry scoring.";
  } else if (unclassified > 0) {
    title = `Classifying ${unclassified} remaining signals`;
    description =
      "The queue is active. Refresh this panel or run processing now to speed up the first pass.";
  } else if (readyActivities > 0) {
    title = "Action list is ready";
    description = "New signals will keep updating this list as they arrive.";
  }

  return (
    <Card className="border-primary/20 shadow-md">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <p className="font-display text-lg font-medium text-foreground">{title}</p>
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          </div>
          <Button onClick={onProcessNow} disabled={isProcessingNow}>
            {isProcessingNow ? "Processing..." : "Process now"}
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span>Pipeline progress</span>
            <span>{processedPercent}% processed</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${processedPercent}%` }}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Imported
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold text-foreground">
              {totalSignals}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Processed
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold text-foreground">
              {processedSignals}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Need response
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold text-foreground">
              {needsResponse}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Ready actions
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold text-foreground">
              {readyActivities}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CommandPage() {
  const { data: activities, isLoading: activitiesLoading, isError } = useActivities();
  const { data: stats, isLoading: statsLoading } = useSignalStats();
  const hasGoogle = useHasConnection("google");
  const hasSlack = useHasConnection("slack");
  const updateActivity = useUpdateActivity();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [snoozeTarget, setSnoozeTarget] = useState<string | null>(null);

  const processNow = useMutation({
    mutationFn: async () => {
      const response = await fetch(withBasePath("/api/command/process"), {
        method: "POST",
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            classified?: number;
            classificationErrors?: number;
            activitiesCreated?: number;
            remainingBefore?: number;
            remainingAfter?: number;
            errorDetails?: string[];
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to process signals");
      }

      return payload;
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["signal-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["activities"] }),
      ]);

      const classified = result?.classified ?? 0;
      const created = result?.activitiesCreated ?? 0;
      const remainingAfter = result?.remainingAfter ?? 0;

      if (classified > 0 || created > 0) {
        toast.success(
          `Processed ${classified} signals and created ${created} activities. ${remainingAfter} still in queue.`
        );
        return;
      }

      if (result?.classificationErrors) {
        toast.error(result.errorDetails?.[0] ?? "Processing ran, but it hit an error.");
        return;
      }

      toast("No new signals needed processing.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to process signals");
    },
  });

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
        totalSignals={stats?.totalSignals ?? 0}
        totalToday={stats?.totalToday ?? 0}
        unclassified={stats?.unclassified ?? 0}
        needsResponse={stats?.needsResponse ?? 0}
        readyActivities={stats?.readyActivities ?? 0}
        isLoading={statsLoading}
      />

      {(hasGoogle || hasSlack) && !statsLoading ? (
        <ProcessingStatusCard
          totalSignals={stats?.totalSignals ?? 0}
          unclassified={stats?.unclassified ?? 0}
          needsResponse={stats?.needsResponse ?? 0}
          readyActivities={stats?.readyActivities ?? 0}
          isProcessingNow={processNow.isPending}
          onProcessNow={() => processNow.mutate()}
        />
      ) : null}

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
                {!hasGoogle && !hasSlack
                  ? "Connect your email and Slack to start seeing prioritized actions."
                  : (stats?.unclassified ?? 0) > 0
                    ? "Signals are still being classified. Use Process now if you want to clear the queue immediately."
                    : (stats?.needsResponse ?? 0) > 0
                      ? "Signals were classified and some need response, but Zoe has not generated activities yet. Use Process now to retry extraction."
                    : (stats?.readyActivities ?? 0) > 0
                      ? "Your action list is ready above. Refresh if you just processed a new batch."
                    : "Your integrations are connected, but there are no actionable items yet."}
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

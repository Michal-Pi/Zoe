"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface SignalStatsBarProps {
  totalSignals: number;
  totalToday: number;
  unclassified: number;
  needsResponse: number;
  readyActivities: number;
  isLoading: boolean;
}

export function SignalStatsBar({
  totalSignals,
  totalToday,
  unclassified,
  needsResponse,
  readyActivities,
  isLoading,
}: SignalStatsBarProps) {
  if (isLoading) {
    return (
      <div className="flex gap-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-28" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
      <span>
        <strong className="font-mono text-foreground">{totalSignals}</strong>{" "}
        imported
      </span>
      <span className="hidden sm:inline text-border">|</span>
      <span>
        <strong className="font-mono text-foreground">{totalToday}</strong>{" "}
        signals today
      </span>
      <span className="hidden sm:inline text-border">|</span>
      <span>
        <strong className="font-mono text-foreground">{unclassified}</strong>{" "}
        processing
      </span>
      <span className="hidden sm:inline text-border">|</span>
      <span>
        <strong className="font-mono text-foreground">{needsResponse}</strong>{" "}
        need response
      </span>
      <span className="hidden sm:inline text-border">|</span>
      <span>
        <strong className="font-mono text-foreground">{readyActivities}</strong>{" "}
        ready actions
      </span>
    </div>
  );
}

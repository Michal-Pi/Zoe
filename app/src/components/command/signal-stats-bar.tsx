"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface SignalStatsBarProps {
  totalToday: number;
  unclassified: number;
  needsResponse: number;
  isLoading: boolean;
}

export function SignalStatsBar({
  totalToday,
  unclassified,
  needsResponse,
  isLoading,
}: SignalStatsBarProps) {
  if (isLoading) {
    return (
      <div className="flex gap-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-32" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
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
    </div>
  );
}

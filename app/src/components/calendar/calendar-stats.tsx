"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface CalendarStatsProps {
  totalMeetings: number;
  totalMinutes: number;
  highDensity: number;
  needsPrep: number;
  riskCount: number;
  isLoading: boolean;
}

export function CalendarStats({
  totalMeetings,
  totalMinutes,
  highDensity,
  needsPrep,
  riskCount,
  isLoading,
}: CalendarStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  }

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const stats = [
    { label: "Meetings", value: totalMeetings, mono: true },
    { label: "In meetings", value: timeStr, mono: true },
    { label: "High density", value: highDensity, mono: true },
    { label: "Needs prep", value: needsPrep, highlight: needsPrep > 0 },
    { label: "Risk flags", value: riskCount, highlight: riskCount > 0 },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg border border-border bg-card p-3"
        >
          <p
            className={`font-mono text-lg font-bold ${stat.highlight ? "text-destructive" : "text-foreground"}`}
          >
            {stat.value}
          </p>
          <p className="text-xs text-muted-foreground">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}

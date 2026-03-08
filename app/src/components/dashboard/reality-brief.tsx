"use client";

import type { RealityBrief } from "@/domain/dashboard";
import { MetricCard } from "./metric-card";

interface RealityBriefSectionProps {
  data: RealityBrief | null;
  loading?: boolean;
  hasCalendar?: boolean;
  hasSlack?: boolean;
  hasEmail?: boolean;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function RealityBriefSection({
  data,
  loading,
  hasCalendar,
  hasSlack,
  hasEmail,
}: RealityBriefSectionProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Today&apos;s Reality
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Real exec time"
          value={data ? formatMinutes(data.availableExecutionMinutes) : "—"}
          subtitle={!hasCalendar ? "Connect calendar" : undefined}
          variant={
            data && data.availableExecutionMinutes < 120
              ? "warning"
              : "default"
          }
          loading={loading}
        />
        <MetricCard
          label="Meetings"
          value={data ? `${data.meetingCount}` : "—"}
          subtitle={
            !hasCalendar
              ? "Connect calendar"
              : data
                ? `${formatMinutes(data.totalMeetingMinutes)} total`
                : undefined
          }
          loading={loading}
        />
        <MetricCard
          label="Slack threads"
          value={data ? `${data.activeSlackThreads}` : "—"}
          subtitle={!hasSlack ? "Connect Slack" : undefined}
          loading={loading}
        />
        <MetricCard
          label="Open loops"
          value={data ? `${data.openLoops}` : "—"}
          subtitle={
            !hasEmail
              ? "Connect email"
              : data && data.openLoops > 0
                ? `${data.openLoops} older than 48h`
                : undefined
          }
          variant={data && data.openLoops > 3 ? "warning" : "default"}
          loading={loading}
        />
      </div>
      {data && (
        <p className="text-sm text-muted-foreground">
          {data.maxMeaningfulTasks <= 2
            ? "Tight day. Attempt no more than 2 meaningful tasks or you'll fragment everything."
            : data.maxMeaningfulTasks <= 3
              ? `If you attempt more than ${data.maxMeaningfulTasks} meaningful tasks, you will fragment your day.`
              : `You have room for ${data.maxMeaningfulTasks} meaningful tasks today.`}
        </p>
      )}
    </section>
  );
}

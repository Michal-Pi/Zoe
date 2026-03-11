"use client";

import type { BehavioralSnapshot, TrendDirection, BehavioralSuggestionData } from "@/domain/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface BehavioralSnapshotSectionProps {
  data: BehavioralSnapshot | null;
  suggestions?: BehavioralSuggestionData[];
  loading?: boolean;
  hasIntegrations?: boolean;
}

function TrendArrow({ trend }: { trend?: TrendDirection }) {
  if (!trend || trend === "stable") {
    return <span className="text-muted-foreground" title="Stable">{"\u2192"}</span>;
  }
  if (trend === "improving") {
    return <span className="text-score-low" title="Improving">{"\u2191"}</span>;
  }
  return <span className="text-score-high" title="Worsening">{"\u2193"}</span>;
}

export function BehavioralSnapshotSection({
  data,
  suggestions,
  loading,
  hasIntegrations,
}: BehavioralSnapshotSectionProps) {
  if (loading) {
    return (
      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          How You&apos;re Operating
        </h2>
        <Card>
          <CardContent className="space-y-4 py-6">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-40" />
          </CardContent>
        </Card>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          How You&apos;re Operating
        </h2>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">
              {hasIntegrations
                ? "Behavioral insights will appear after a few days of synced activity."
                : "Connect your integrations to see behavioral insights."}
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  const stats = [
    {
      label: "Reactive activity",
      value: `${Math.round(data.reactiveActivityPct)}%`,
      detail: "of your activity was Slack/email driven",
      isWarning: data.reactiveActivityPct > 60,
      trend: data.reactiveActivityTrend,
    },
    {
      label: "Deep work blocks",
      value: `${data.deepWorkBlocks}`,
      detail: "blocks longer than 60 minutes",
      isWarning: data.deepWorkBlocks === 0,
      trend: data.deepWorkTrend,
    },
    {
      label: "Meetings with outcomes",
      value: `${data.meetingsWithOutcomes}/${data.meetingsTotal}`,
      detail: "had documented outcomes",
      isWarning:
        data.meetingsTotal > 0 &&
        data.meetingsWithOutcomes / data.meetingsTotal < 0.5,
    },
    {
      label: "Meetings prepared",
      value: `${data.meetingsPreparedOnTime}`,
      detail: "prepared on time",
      isWarning: false,
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          How You&apos;re Operating
        </h2>
        <span className="text-xs text-muted-foreground">
          {data.periodLabel}
        </span>
      </div>
      <Card>
        <CardContent className="py-6">
          <ul className="space-y-4">
            {stats.map((stat) => (
              <li key={stat.label} className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-1 h-2 w-2 shrink-0 rounded-full",
                    stat.isWarning ? "bg-score-high" : "bg-score-low"
                  )}
                />
                <div>
                  <span className="font-mono text-sm font-medium text-foreground">
                    {stat.value}
                  </span>
                  {stat.trend && (
                    <>
                      {" "}
                      <TrendArrow trend={stat.trend} />
                    </>
                  )}
                  {" "}
                  <span className="text-sm text-muted-foreground">
                    {stat.detail}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {suggestions && suggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <ul className="space-y-3">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <p className="text-sm font-medium text-foreground">
                    {s.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.description}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

"use client";

import type { Intervention } from "@/domain/dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface InterventionsSectionProps {
  interventions: Intervention[];
  loading?: boolean;
}

const typeIcons: Record<Intervention["type"], string> = {
  protect: "🛡",
  prepare: "📋",
  batch: "📦",
  delegate: "👋",
  cancel: "✕",
};

export function InterventionsSection({
  interventions,
  loading,
}: InterventionsSectionProps) {
  if (loading) {
    return (
      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          What to Do Differently
        </h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="flex items-start gap-3 py-4">
                <Skeleton className="h-8 w-8 shrink-0 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-64" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  if (interventions.length === 0) {
    return (
      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          What to Do Differently
        </h2>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">
              Zoe will suggest improvements once she learns your patterns.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        What to Do Differently
      </h2>
      <p className="text-sm text-muted-foreground">
        To run today intentionally:
      </p>
      <div className="space-y-3">
        {interventions.map((intervention, index) => (
          <Card key={intervention.id}>
            <CardContent className="flex items-start gap-3 py-4">
              <span className="mt-0.5 text-lg" aria-hidden="true">
                {typeIcons[intervention.type]}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {intervention.title}
                  </p>
                  {intervention.timeEstimateMinutes && (
                    <Badge variant="secondary" className="font-mono text-xs">
                      {intervention.timeEstimateMinutes}m
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {intervention.description}
                </p>
              </div>
              <span
                className={cn(
                  "font-mono text-xs font-medium",
                  intervention.priority === "high"
                    ? "text-score-high"
                    : intervention.priority === "medium"
                      ? "text-score-medium"
                      : "text-muted-foreground"
                )}
              >
                {index + 1}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

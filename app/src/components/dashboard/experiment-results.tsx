"use client";

import { useQuery } from "@tanstack/react-query";
import { withBasePath } from "@/lib/base-path";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ArmSummary {
  arm: string;
  isShadow: boolean;
  count: number;
  avgCostPerSignal: number;
  avgLatencyMs: number;
  avgConfidence: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  heuristicRate: number;
  llmRate: number;
  requiresResponseRate: number;
}

interface Agreement {
  comparedCount: number;
  requiresResponseRate: number;
  ownershipRate: number;
  escalationRate: number;
  urgencyCloseRate: number;
}

interface ResultsData {
  armSummaries: ArmSummary[];
  agreement: Agreement | null;
  totalResults: number;
}

export function ExperimentResults({
  experimentId,
}: {
  experimentId: string | null;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "experiment-results", experimentId],
    queryFn: async () => {
      if (!experimentId) return null;
      const res = await fetch(
        withBasePath(`/api/admin/experiments/results?experiment_id=${experimentId}`)
      );
      if (!res.ok) throw new Error("Failed to fetch results");
      const json = await res.json();
      return json.data as ResultsData;
    },
    enabled: !!experimentId,
    refetchInterval: 30_000,
  });

  if (!experimentId) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-muted-foreground">
            Experiment Results
          </CardTitle>
          <CardDescription>
            Activate an experiment to see route comparison data.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Experiment Results</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const { armSummaries, agreement, totalResults } = data;

  if (totalResults === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Experiment Results</CardTitle>
          <CardDescription>
            No results yet. Results will appear as the cron processes signals.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Experiment Results</CardTitle>
        <CardDescription>
          {totalResults.toLocaleString()} results recorded
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Route comparison table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 font-medium">Route</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium text-right">Signals</th>
                <th className="pb-2 font-medium text-right">Avg Cost</th>
                <th className="pb-2 font-medium text-right">Avg Latency</th>
                <th className="pb-2 font-medium text-right">Heuristic %</th>
                <th className="pb-2 font-medium text-right">LLM %</th>
                <th className="pb-2 font-medium text-right">Needs Reply %</th>
              </tr>
            </thead>
            <tbody>
              {armSummaries.map((s) => (
                <tr
                  key={`${s.arm}-${s.isShadow}`}
                  className="border-b border-border/50"
                >
                  <td className="py-2 font-mono font-medium">
                    Route {s.arm}
                  </td>
                  <td className="py-2 text-xs">
                    {s.isShadow ? (
                      <span className="text-muted-foreground">shadow</span>
                    ) : (
                      <span className="text-primary">primary</span>
                    )}
                  </td>
                  <td className="py-2 text-right font-mono">{s.count}</td>
                  <td className="py-2 text-right font-mono text-xs">
                    ${s.avgCostPerSignal.toFixed(6)}
                  </td>
                  <td className="py-2 text-right font-mono text-xs">
                    {s.avgLatencyMs}ms
                  </td>
                  <td className="py-2 text-right font-mono text-xs">
                    {(s.heuristicRate * 100).toFixed(0)}%
                  </td>
                  <td className="py-2 text-right font-mono text-xs">
                    {(s.llmRate * 100).toFixed(0)}%
                  </td>
                  <td className="py-2 text-right font-mono text-xs">
                    {(s.requiresResponseRate * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Agreement analysis */}
        {agreement && (
          <div>
            <h4 className="text-sm font-medium mb-2">
              Primary vs Shadow Agreement ({agreement.comparedCount} signals
              compared)
            </h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <AgreementMetric
                label="Needs Response"
                rate={agreement.requiresResponseRate}
              />
              <AgreementMetric
                label="Ownership"
                rate={agreement.ownershipRate}
              />
              <AgreementMetric
                label="Escalation"
                rate={agreement.escalationRate}
              />
              <AgreementMetric
                label="Urgency (±15)"
                rate={agreement.urgencyCloseRate}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AgreementMetric({ label, rate }: { label: string; rate: number }) {
  const pct = (rate * 100).toFixed(0);
  const color =
    rate >= 0.9
      ? "text-green-600"
      : rate >= 0.75
        ? "text-yellow-600"
        : "text-destructive";

  return (
    <div className="text-center border border-border/50 rounded-md p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-mono text-lg font-semibold ${color}`}>{pct}%</p>
    </div>
  );
}

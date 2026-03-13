"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useIsAdmin } from "@/hooks/use-admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface UsageRow {
  operation: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_usd: number | null;
  created_at: string;
  user_id: string;
}

interface StuckWorkObject {
  id: string;
  title: string;
  extraction_attempts: number;
  extraction_failed_at: string | null;
  user_id: string;
  updated_at: string;
}

interface AdminData {
  usage: UsageRow[];
  stuckWorkObjects: StuckWorkObject[];
  totalUsers: number;
}

function useAdminUsage() {
  return useQuery({
    queryKey: ["admin", "usage"],
    queryFn: async () => {
      const res = await fetch("/api/admin/usage");
      if (!res.ok) throw new Error("Failed to fetch admin data");
      const json = await res.json();
      return json.data as AdminData;
    },
    refetchInterval: 60_000,
  });
}

export default function AdminPage() {
  const isAdmin = useIsAdmin();
  const router = useRouter();
  const { data, isLoading, isError } = useAdminUsage();

  if (!isAdmin) {
    router.replace("/dashboard");
    return null;
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            System Admin
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            System Admin
          </h1>
          <p className="mt-1 text-sm text-destructive">
            Failed to load admin data.
          </p>
        </div>
      </div>
    );
  }

  const { usage, stuckWorkObjects, totalUsers } = data;

  // Aggregate stats
  const totalCalls = usage.length;
  const totalInputTokens = usage.reduce(
    (sum, r) => sum + (r.input_tokens ?? 0),
    0
  );
  const totalOutputTokens = usage.reduce(
    (sum, r) => sum + (r.output_tokens ?? 0),
    0
  );
  const totalCost = usage.reduce(
    (sum, r) => sum + (r.estimated_cost_usd ?? 0),
    0
  );

  // Per-operation breakdown
  const byOperation = new Map<
    string,
    { calls: number; input: number; output: number; cost: number }
  >();
  for (const row of usage) {
    const key = row.operation;
    const current = byOperation.get(key) ?? {
      calls: 0,
      input: 0,
      output: 0,
      cost: 0,
    };
    current.calls++;
    current.input += row.input_tokens ?? 0;
    current.output += row.output_tokens ?? 0;
    current.cost += row.estimated_cost_usd ?? 0;
    byOperation.set(key, current);
  }
  const operationRows = [...byOperation.entries()].sort(
    (a, b) => b[1].cost - a[1].cost
  );

  // Per-model breakdown
  const byModel = new Map<
    string,
    { calls: number; input: number; output: number; cost: number }
  >();
  for (const row of usage) {
    const key = row.model;
    const current = byModel.get(key) ?? {
      calls: 0,
      input: 0,
      output: 0,
      cost: 0,
    };
    current.calls++;
    current.input += row.input_tokens ?? 0;
    current.output += row.output_tokens ?? 0;
    current.cost += row.estimated_cost_usd ?? 0;
    byModel.set(key, current);
  }
  const modelRows = [...byModel.entries()].sort(
    (a, b) => b[1].cost - a[1].cost
  );

  // Daily cost breakdown (last 30 days)
  const byDay = new Map<string, number>();
  for (const row of usage) {
    const day = row.created_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + (row.estimated_cost_usd ?? 0));
  }
  const dailyCosts = [...byDay.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  const maxDailyCost = Math.max(...dailyCosts.map((d) => d[1]), 0.001);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">
          System Admin
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          LLM usage monitoring and system health (last 30 days)
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Calls" value={totalCalls.toLocaleString()} />
        <StatCard
          label="Total Cost"
          value={`$${totalCost.toFixed(4)}`}
          mono
        />
        <StatCard
          label="Input Tokens"
          value={formatTokens(totalInputTokens)}
          mono
        />
        <StatCard
          label="Output Tokens"
          value={formatTokens(totalOutputTokens)}
          mono
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Users" value={String(totalUsers)} />
        <StatCard
          label="Avg Cost/Call"
          value={totalCalls > 0 ? `$${(totalCost / totalCalls).toFixed(5)}` : "$0"}
          mono
        />
        <StatCard
          label="Stuck Work Objects"
          value={String(stuckWorkObjects.length)}
          alert={stuckWorkObjects.some((wo) => wo.extraction_failed_at)}
        />
        <StatCard
          label="Failed Extractions"
          value={String(
            stuckWorkObjects.filter((wo) => wo.extraction_failed_at).length
          )}
          alert={stuckWorkObjects.some((wo) => wo.extraction_failed_at)}
        />
      </div>

      {/* Daily cost chart */}
      {dailyCosts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Cost</CardTitle>
            <CardDescription>USD per day over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-px h-40">
              {dailyCosts.map(([day, cost]) => (
                <div
                  key={day}
                  className="flex-1 group relative"
                  title={`${day}: $${cost.toFixed(4)}`}
                >
                  <div
                    className="w-full rounded-t bg-primary/80 group-hover:bg-primary transition-colors"
                    style={{
                      height: `${Math.max((cost / maxDailyCost) * 100, 2)}%`,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
              <span>{dailyCosts[0]?.[0]}</span>
              <span>{dailyCosts[dailyCosts.length - 1]?.[0]}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-operation breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Cost by Operation</CardTitle>
          <CardDescription>
            Token usage and cost per LLM operation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {operationRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No usage data yet. Data will appear after LLM calls are made.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Operation</th>
                    <th className="pb-2 font-medium text-right">Calls</th>
                    <th className="pb-2 font-medium text-right">Input</th>
                    <th className="pb-2 font-medium text-right">Output</th>
                    <th className="pb-2 font-medium text-right">Cost</th>
                    <th className="pb-2 font-medium text-right">Avg/Call</th>
                  </tr>
                </thead>
                <tbody>
                  {operationRows.map(([op, stats]) => (
                    <tr key={op} className="border-b border-border/50">
                      <td className="py-2 font-mono text-xs">{op}</td>
                      <td className="py-2 text-right font-mono">
                        {stats.calls}
                      </td>
                      <td className="py-2 text-right font-mono text-xs">
                        {formatTokens(stats.input)}
                      </td>
                      <td className="py-2 text-right font-mono text-xs">
                        {formatTokens(stats.output)}
                      </td>
                      <td className="py-2 text-right font-mono">
                        ${stats.cost.toFixed(4)}
                      </td>
                      <td className="py-2 text-right font-mono text-xs">
                        ${(stats.cost / stats.calls).toFixed(5)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-model breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Cost by Model</CardTitle>
        </CardHeader>
        <CardContent>
          {modelRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {modelRows.map(([model, stats]) => {
                const pct =
                  totalCost > 0
                    ? (stats.cost / totalCost) * 100
                    : 0;
                return (
                  <div key={model}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-mono text-xs">{model}</span>
                      <span className="font-mono">
                        ${stats.cost.toFixed(4)} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stuck work objects */}
      {stuckWorkObjects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Extraction Retries</CardTitle>
            <CardDescription>
              Work objects with failed or pending extraction attempts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Title</th>
                    <th className="pb-2 font-medium text-right">Attempts</th>
                    <th className="pb-2 font-medium text-right">Status</th>
                    <th className="pb-2 font-medium text-right">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {stuckWorkObjects.map((wo) => (
                    <tr key={wo.id} className="border-b border-border/50">
                      <td className="py-2 max-w-[200px] truncate">
                        {wo.title}
                      </td>
                      <td className="py-2 text-right font-mono">
                        {wo.extraction_attempts}/3
                      </td>
                      <td className="py-2 text-right">
                        {wo.extraction_failed_at ? (
                          <span className="text-destructive font-medium">
                            Failed
                          </span>
                        ) : (
                          <span className="text-warning">Retrying</span>
                        )}
                      </td>
                      <td className="py-2 text-right text-xs text-muted-foreground">
                        {new Date(wo.updated_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Placeholder sections for future phases */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-muted-foreground">
            Experiment Controls
          </CardTitle>
          <CardDescription>
            A/B/C route assignment, shadow routing, and experiment config will
            appear here (Phase 3).
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-muted-foreground">
            Triage Evaluation
          </CardTitle>
          <CardDescription>
            Route comparison, heuristic accuracy, disagreement mining, and
            calibration tools will appear here (Phase 5).
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-muted-foreground">Budget Controls</CardTitle>
          <CardDescription>
            Per-user caps, per-feature caps, anomaly detection, and budget
            alerts will appear here (Phase 7).
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  mono,
  alert,
}: {
  label: string;
  value: string;
  mono?: boolean;
  alert?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`text-lg font-semibold ${mono ? "font-mono" : ""} ${
            alert ? "text-destructive" : "text-foreground"
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

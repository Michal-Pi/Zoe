"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Experiment {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "paused" | "completed";
  arm_weights: { A: number; B: number; C: number };
  shadow_enabled: boolean;
  shadow_arm: string | null;
  shadow_sample_rate: number;
  version: number;
  created_at: string;
  updated_at: string;
}

interface ExperimentsData {
  experiments: Experiment[];
  assignmentCounts: Record<string, Record<string, number>>;
  resultCounts: Record<string, { primary: number; shadow: number }>;
}

function useExperiments() {
  return useQuery({
    queryKey: ["admin", "experiments"],
    queryFn: async () => {
      const res = await fetch("/api/admin/experiments");
      if (!res.ok) throw new Error("Failed to fetch experiments");
      const json = await res.json();
      return json.data as ExperimentsData;
    },
    refetchInterval: 30_000,
  });
}

export function ExperimentControls() {
  const { data, isLoading } = useExperiments();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const patchMutation = useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: Record<string, unknown>;
    }) => {
      const res = await fetch(`/api/admin/experiments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update experiment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "experiments"] });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Experiment Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const experiments = data?.experiments ?? [];
  const activeExperiment = experiments.find((e) => e.status === "active");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Experiment Controls</CardTitle>
            <CardDescription>
              A/B/C route assignment and shadow routing
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreate(!showCreate)}
          >
            {showCreate ? "Cancel" : "New Experiment"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showCreate && (
          <CreateExperimentForm
            onCreated={() => {
              setShowCreate(false);
              queryClient.invalidateQueries({
                queryKey: ["admin", "experiments"],
              });
            }}
          />
        )}

        {activeExperiment && (
          <ActiveExperimentCard
            experiment={activeExperiment}
            assignments={data?.assignmentCounts[activeExperiment.id] ?? {}}
            results={data?.resultCounts[activeExperiment.id] ?? { primary: 0, shadow: 0 }}
            onAction={(body) =>
              patchMutation.mutate({ id: activeExperiment.id, body })
            }
          />
        )}

        {!activeExperiment && !showCreate && (
          <p className="text-sm text-muted-foreground">
            No active experiment. Create one to start A/B/C routing.
          </p>
        )}

        {experiments.filter((e) => e.status !== "active").length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Other Experiments
            </h4>
            <div className="space-y-2">
              {experiments
                .filter((e) => e.status !== "active")
                .slice(0, 5)
                .map((exp) => (
                  <div
                    key={exp.id}
                    className="flex items-center justify-between text-sm border border-border/50 rounded-md p-2"
                  >
                    <div>
                      <span className="font-medium">{exp.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        v{exp.version} · {exp.status}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {exp.status === "draft" || exp.status === "paused" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            patchMutation.mutate({
                              id: exp.id,
                              body: { status: "active" },
                            })
                          }
                        >
                          Activate
                        </Button>
                      ) : null}
                      {exp.status !== "completed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            patchMutation.mutate({
                              id: exp.id,
                              body: { status: "completed" },
                            })
                          }
                        >
                          Archive
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActiveExperimentCard({
  experiment,
  assignments,
  results,
  onAction,
}: {
  experiment: Experiment;
  assignments: Record<string, number>;
  results: { primary: number; shadow: number };
  onAction: (body: Record<string, unknown>) => void;
}) {
  const totalAssigned =
    (assignments.A ?? 0) + (assignments.B ?? 0) + (assignments.C ?? 0);

  return (
    <div className="border border-primary/30 bg-primary/5 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">{experiment.name}</h4>
          {experiment.description && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {experiment.description}
            </p>
          )}
        </div>
        <span className="text-xs font-mono bg-primary/20 text-primary rounded px-2 py-0.5">
          v{experiment.version} · ACTIVE
        </span>
      </div>

      {/* Arm weights bar */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Arm Weights</p>
        <div className="flex h-6 rounded-md overflow-hidden">
          {experiment.arm_weights.A > 0 && (
            <div
              className="bg-primary flex items-center justify-center text-xs text-primary-foreground font-mono"
              style={{ width: `${experiment.arm_weights.A}%` }}
            >
              A:{experiment.arm_weights.A}%
            </div>
          )}
          {experiment.arm_weights.B > 0 && (
            <div
              className="bg-secondary flex items-center justify-center text-xs text-secondary-foreground font-mono"
              style={{ width: `${experiment.arm_weights.B}%` }}
            >
              B:{experiment.arm_weights.B}%
            </div>
          )}
          {experiment.arm_weights.C > 0 && (
            <div
              className="bg-accent flex items-center justify-center text-xs text-accent-foreground font-mono"
              style={{ width: `${experiment.arm_weights.C}%` }}
            >
              C:{experiment.arm_weights.C}%
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Users</p>
          <p className="font-mono text-sm">{totalAssigned}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Primary</p>
          <p className="font-mono text-sm">{results.primary}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Shadow</p>
          <p className="font-mono text-sm">{results.shadow}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Shadow Rate</p>
          <p className="font-mono text-sm">
            {experiment.shadow_enabled
              ? `${(experiment.shadow_sample_rate * 100).toFixed(0)}%`
              : "Off"}
          </p>
        </div>
      </div>

      {/* Shadow config */}
      <div className="flex items-center gap-2 text-sm">
        <label className="text-muted-foreground">Shadow:</label>
        <Button
          variant={experiment.shadow_enabled ? "default" : "outline"}
          size="sm"
          onClick={() =>
            onAction({ shadow_enabled: !experiment.shadow_enabled })
          }
        >
          {experiment.shadow_enabled ? "Enabled" : "Disabled"}
        </Button>
        {experiment.shadow_enabled && (
          <>
            <span className="text-muted-foreground">Arm:</span>
            {(["A", "B", "C"] as const).map((arm) => (
              <Button
                key={arm}
                variant={experiment.shadow_arm === arm ? "default" : "outline"}
                size="sm"
                onClick={() => onAction({ shadow_arm: arm })}
              >
                {arm}
              </Button>
            ))}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAction({ status: "paused" })}
        >
          Pause
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAction({ bump_version: true })}
        >
          Bump Version
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAction({ status: "completed" })}
        >
          Complete
        </Button>
      </div>
    </div>
  );
}

function CreateExperimentForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [weightA, setWeightA] = useState(100);
  const [weightB, setWeightB] = useState(0);
  const [weightC, setWeightC] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sum = weightA + weightB + weightC;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || sum !== 100) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          arm_weights: { A: weightA, B: weightB, C: weightC },
        }),
      });
      if (res.ok) onCreated();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-border rounded-md p-3 space-y-3"
    >
      <Input
        placeholder="Experiment name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Route A %</label>
          <Input
            type="number"
            min={0}
            max={100}
            value={weightA}
            onChange={(e) => setWeightA(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Route B %</label>
          <Input
            type="number"
            min={0}
            max={100}
            value={weightB}
            onChange={(e) => setWeightB(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Route C %</label>
          <Input
            type="number"
            min={0}
            max={100}
            value={weightC}
            onChange={(e) => setWeightC(Number(e.target.value))}
          />
        </div>
      </div>
      {sum !== 100 && (
        <p className="text-xs text-destructive">
          Weights must sum to 100 (current: {sum})
        </p>
      )}
      <Button type="submit" size="sm" disabled={!name || sum !== 100 || isSubmitting}>
        {isSubmitting ? "Creating..." : "Create Experiment"}
      </Button>
    </form>
  );
}

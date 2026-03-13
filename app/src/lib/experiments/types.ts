export type Arm = "A" | "B" | "C";

export interface TriageExperiment {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "paused" | "completed";
  arm_weights: Record<Arm, number>;
  shadow_enabled: boolean;
  shadow_arm: Arm | null;
  shadow_sample_rate: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ExperimentDecision {
  experimentId: string | null;
  experimentVersion: number;
  primaryArm: Arm;
  shadowArm: Arm | null;
}

export interface RouteResult {
  signalId: string;
  urgencyScore: number;
  topicCluster: string;
  ownershipSignal: string;
  requiresResponse: boolean;
  escalationLevel: string;
  confidence: number;
  usedHeuristic: boolean;
  usedSnippetModel: boolean;
  usedFullModel: boolean;
  modelName: string | null;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  reasonCodes: string[];
}

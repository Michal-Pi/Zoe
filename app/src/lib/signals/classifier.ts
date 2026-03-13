import { generateObject } from "ai";
import { models } from "@/lib/ai/providers";
import {
  batchClassificationSchema,
  type BatchClassification,
} from "@/lib/ai/schemas/classification";
import { buildClassificationPrompt } from "@/lib/ai/prompts/classify-signals";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getRedis } from "@/lib/cache/redis";
import { logLLMUsage } from "@/lib/monitoring/llm-costs";
import {
  classifyToLabelKey,
  applyZoeLabel,
  ensureZoeLabels,
  getCachedLabelIds,
  cacheLabelIds,
} from "@/lib/integrations/gmail-labels";
import {
  classifyBatchWithHeuristics,
} from "@/lib/scoring/heuristic-classifier";
import { resolveExperiment } from "@/lib/experiments/resolver";
import { recordTriageResults } from "@/lib/experiments/record-result";
import type { Arm, RouteResult } from "@/lib/experiments/types";

const BATCH_SIZE = 15;

type Signal = {
  id: string;
  source: string;
  source_type: string;
  external_id?: string;
  title: string | null;
  snippet: string | null;
  sender_name: string | null;
  sender_email: string | null;
  received_at: string;
  labels: string[] | null;
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function clampUrgencyScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

// ── Classification result from any route ─────────────────────────

interface ClassificationOutput {
  signal_id: string;
  urgency_score: number;
  topic_cluster: string;
  ownership_signal: "owner" | "contributor" | "observer";
  requires_response: boolean;
  escalation_level: "none" | "mild" | "high";
  confidence: number;
  usedHeuristic: boolean;
  usedLLM: boolean;
  modelName: string | null;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

// ── Route A: heuristic pre-filter + LLM for ambiguous ────────────

async function runRouteA(
  signals: Signal[],
  priorityTitles: string[],
  userId: string
): Promise<ClassificationOutput[]> {
  const results: ClassificationOutput[] = [];

  // Heuristic pre-filter
  const { accepted: heuristicAccepted, needsLLM: llmSignals } =
    classifyBatchWithHeuristics(
      signals.map((s) => ({
        id: s.id,
        source: s.source,
        source_type: s.source_type,
        title: s.title,
        snippet: s.snippet,
        sender_name: s.sender_name,
        sender_email: s.sender_email,
        received_at: s.received_at,
        labels: s.labels,
      })),
      priorityTitles
    );

  // Heuristic results
  for (const r of heuristicAccepted) {
    results.push({
      signal_id: r.signal_id,
      urgency_score: r.urgency_score,
      topic_cluster: r.topic_cluster,
      ownership_signal: r.ownership_signal,
      requires_response: r.requires_response,
      escalation_level: r.escalation_level,
      confidence: r.confidence,
      usedHeuristic: true,
      usedLLM: false,
      modelName: null,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
    });
  }

  // LLM for low-confidence signals
  const llmSignalIds = new Set(llmSignals.map((s) => s.id));
  const signalsForLLM = signals.filter((s) => llmSignalIds.has(s.id));
  const llmResults = await runLLMClassification(signalsForLLM, priorityTitles, userId);
  results.push(...llmResults);

  return results;
}

// ── Route C: full LLM for all signals (no heuristic) ─────────────

async function runRouteC(
  signals: Signal[],
  priorityTitles: string[],
  userId: string
): Promise<ClassificationOutput[]> {
  return runLLMClassification(signals, priorityTitles, userId);
}

// ── Shared LLM classification logic ──────────────────────────────

async function runLLMClassification(
  signals: Signal[],
  priorityTitles: string[],
  userId: string
): Promise<ClassificationOutput[]> {
  if (!signals.length) return [];

  const results: ClassificationOutput[] = [];
  const redis = getRedis();
  const CACHE_TTL = 86400;

  for (let i = 0; i < signals.length; i += BATCH_SIZE) {
    const batch = signals.slice(i, i + BATCH_SIZE);

    // Check cache
    const cachedResults: Map<
      string,
      BatchClassification["classifications"][number]
    > = new Map();
    const uncachedSignals: Signal[] = [];

    if (redis) {
      for (const signal of batch) {
        const cacheKey = `classify:${signal.source}:${signal.id}`;
        try {
          const cached = await redis.get<
            BatchClassification["classifications"][number]
          >(cacheKey);
          if (cached) {
            cachedResults.set(signal.id, cached);
          } else {
            uncachedSignals.push(signal);
          }
        } catch {
          uncachedSignals.push(signal);
        }
      }
    } else {
      uncachedSignals.push(...batch);
    }

    // LLM call for uncached
    let llmClassifications: BatchClassification["classifications"] = [];
    let batchInputTokens = 0;
    let batchOutputTokens = 0;
    let batchLatencyMs = 0;

    if (uncachedSignals.length > 0) {
      const prompt = buildClassificationPrompt(
        uncachedSignals.map((s) => ({
          id: s.id,
          source: s.source,
          sourceType: s.source_type,
          title: s.title,
          snippet: s.snippet,
          senderName: s.sender_name,
          senderEmail: s.sender_email,
          receivedAt: s.received_at,
          labels: s.labels,
        })),
        priorityTitles
      );

      const startTime = Date.now();
      const { object, usage: classifyUsage } = await generateObject({
        model: models.fast,
        schema: batchClassificationSchema,
        prompt,
      });
      batchLatencyMs = Date.now() - startTime;
      batchInputTokens = classifyUsage?.inputTokens ?? 0;
      batchOutputTokens = classifyUsage?.outputTokens ?? 0;

      if (classifyUsage) {
        logLLMUsage({
          model: "claude-haiku-4-5-latest",
          operation: "classify_signals",
          inputTokens: batchInputTokens,
          outputTokens: batchOutputTokens,
          userId,
          metadata: { batchSize: uncachedSignals.length },
        });
      }

      llmClassifications = object.classifications;

      // Cache results
      if (redis) {
        for (const classification of llmClassifications) {
          const signal = uncachedSignals.find(
            (s) => s.id === classification.signal_id
          );
          if (signal) {
            const cacheKey = `classify:${signal.source}:${signal.id}`;
            try {
              await redis.set(cacheKey, classification, { ex: CACHE_TTL });
            } catch {
              // Non-critical cache write failure
            }
          }
        }
      }
    }

    // Merge cached + fresh
    const allClassifications = [
      ...llmClassifications,
      ...Array.from(cachedResults.values()),
    ];

    // Per-signal token attribution (approximate)
    const tokensPerSignal =
      uncachedSignals.length > 0
        ? {
            input: Math.round(batchInputTokens / uncachedSignals.length),
            output: Math.round(batchOutputTokens / uncachedSignals.length),
            latency: Math.round(batchLatencyMs / uncachedSignals.length),
          }
        : { input: 0, output: 0, latency: 0 };

    for (const c of allClassifications) {
      const wasCached = cachedResults.has(c.signal_id);
      results.push({
        signal_id: c.signal_id,
        urgency_score: c.urgency_score,
        topic_cluster: c.topic_cluster,
        ownership_signal: c.ownership_signal,
        requires_response: c.requires_response,
        escalation_level: c.escalation_level,
        confidence: 0.5, // LLM doesn't return confidence; use baseline
        usedHeuristic: false,
        usedLLM: !wasCached,
        modelName: wasCached ? "cache" : "claude-haiku-4-5-latest",
        inputTokens: wasCached ? 0 : tokensPerSignal.input,
        outputTokens: wasCached ? 0 : tokensPerSignal.output,
        latencyMs: wasCached ? 0 : tokensPerSignal.latency,
      });
    }
  }

  return results;
}

// ── Run a route by arm name ──────────────────────────────────────

async function runRoute(
  arm: Arm,
  signals: Signal[],
  priorityTitles: string[],
  userId: string
): Promise<ClassificationOutput[]> {
  switch (arm) {
    case "A":
      return runRouteA(signals, priorityTitles, userId);
    case "B":
      // Route B (snippet-only) not yet implemented — falls back to Route C
      return runRouteC(signals, priorityTitles, userId);
    case "C":
      return runRouteC(signals, priorityTitles, userId);
  }
}

// ── Main entry point ─────────────────────────────────────────────

/** Classify unclassified signals for a user */
export async function classifySignals(userId: string): Promise<{
  classified: number;
  errors: number;
  errorDetails: string[];
}> {
  const supabase = await createServiceRoleClient();

  // Fetch unclassified signals
  const { data: signals, error } = await supabase
    .from("signals")
    .select(
      "id, source, source_type, external_id, title, snippet, sender_name, sender_email, received_at, labels"
    )
    .eq("user_id", userId)
    .is("classified_at", null)
    .order("received_at", { ascending: false })
    .limit(BATCH_SIZE * 3);

  if (error || !signals?.length) {
    return {
      classified: 0,
      errors: 0,
      errorDetails: error ? [getErrorMessage(error)] : [],
    };
  }

  // Fetch user's strategic priorities
  const { data: priorities } = await supabase
    .from("strategic_priorities")
    .select("title")
    .eq("user_id", userId)
    .order("sort_order");

  const priorityTitles = priorities?.map((p) => p.title) ?? [];

  // Resolve experiment assignment
  const decision = await resolveExperiment(userId);

  let classified = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  // Run primary route
  let primaryResults: ClassificationOutput[];
  try {
    primaryResults = await runRoute(
      decision.primaryArm,
      signals,
      priorityTitles,
      userId
    );
  } catch (err) {
    return {
      classified: 0,
      errors: signals.length,
      errorDetails: [`Primary route ${decision.primaryArm} failed: ${getErrorMessage(err)}`],
    };
  }

  // Write primary results to signals table
  const writtenClassifications: BatchClassification["classifications"] = [];

  for (const result of primaryResults) {
    const { error: updateError } = await supabase
      .from("signals")
      .update({
        urgency_score: clampUrgencyScore(result.urgency_score),
        topic_cluster: result.topic_cluster,
        ownership_signal: result.ownership_signal,
        requires_response: result.requires_response,
        escalation_level: result.escalation_level,
        classified_at: new Date().toISOString(),
      })
      .eq("id", result.signal_id)
      .eq("user_id", userId);

    if (updateError) {
      const message = `signal update failed for ${result.signal_id}: ${getErrorMessage(updateError)}`;
      errorDetails.push(message);
      errors++;
    } else {
      classified++;
      writtenClassifications.push({
        signal_id: result.signal_id,
        urgency_score: result.urgency_score,
        topic_cluster: result.topic_cluster,
        ownership_signal: result.ownership_signal,
        requires_response: result.requires_response,
        escalation_level: result.escalation_level,
      });
    }
  }

  // Apply Gmail labels (primary only)
  await applyGmailLabels(userId, signals, writtenClassifications, supabase);

  // Log heuristic usage separately for monitoring
  const heuristicCount = primaryResults.filter((r) => r.usedHeuristic).length;
  if (heuristicCount > 0) {
    logLLMUsage({
      model: "heuristic",
      operation: "classify_heuristic",
      inputTokens: 0,
      outputTokens: 0,
      userId,
      metadata: { count: heuristicCount, skippedLLM: true },
    });
  }

  // Record primary triage results
  if (decision.experimentId) {
    recordTriageResults({
      experimentId: decision.experimentId,
      userId,
      arm: decision.primaryArm,
      isShadow: false,
      results: primaryResults.map(toRouteResult),
    });
  }

  // Fire-and-forget shadow run (never writes to signals, never applies labels)
  if (decision.experimentId && decision.shadowArm) {
    const shadowArm = decision.shadowArm;
    const expId = decision.experimentId;
    Promise.resolve().then(async () => {
      try {
        const shadowResults = await runRoute(
          shadowArm,
          signals,
          priorityTitles,
          userId
        );
        recordTriageResults({
          experimentId: expId,
          userId,
          arm: shadowArm,
          isShadow: true,
          results: shadowResults.map(toRouteResult),
        });
      } catch (err) {
        console.error("Shadow route failed (non-blocking):", getErrorMessage(err));
      }
    });
  }

  return { classified, errors, errorDetails: errorDetails.slice(0, 10) };
}

function toRouteResult(c: ClassificationOutput): RouteResult {
  // Cost estimation: Haiku pricing as of 2025
  const HAIKU_INPUT_COST = 0.25 / 1_000_000; // $0.25/1M input tokens
  const HAIKU_OUTPUT_COST = 1.25 / 1_000_000; // $1.25/1M output tokens

  return {
    signalId: c.signal_id,
    urgencyScore: c.urgency_score,
    topicCluster: c.topic_cluster,
    ownershipSignal: c.ownership_signal,
    requiresResponse: c.requires_response,
    escalationLevel: c.escalation_level,
    confidence: c.confidence,
    usedHeuristic: c.usedHeuristic,
    usedSnippetModel: false,
    usedFullModel: c.usedLLM,
    modelName: c.modelName,
    inputTokens: c.inputTokens,
    outputTokens: c.outputTokens,
    estimatedCostUsd:
      c.inputTokens * HAIKU_INPUT_COST + c.outputTokens * HAIKU_OUTPUT_COST,
    latencyMs: c.latencyMs,
    reasonCodes: c.usedHeuristic ? ["heuristic_accepted"] : ["llm_classified"],
  };
}

/** Apply Zoe Gmail labels to classified email signals (best-effort, non-blocking) */
async function applyGmailLabels(
  userId: string,
  batch: Array<{ id: string; source: string; external_id?: string }>,
  classifications: BatchClassification["classifications"],
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>
): Promise<void> {
  const gmailSignals = batch.filter((s) => s.source === "gmail" && s.external_id);
  if (!gmailSignals.length) return;

  try {
    const { data: connection } = await supabase
      .from("integration_connections")
      .select("id")
      .eq("user_id", userId)
      .eq("provider", "google")
      .eq("status", "active")
      .limit(1)
      .single();

    if (!connection) return;

    let labelIds = await getCachedLabelIds(connection.id);
    if (!labelIds) {
      labelIds = await ensureZoeLabels(connection.id);
      await cacheLabelIds(connection.id, labelIds);
    }

    for (const signal of gmailSignals) {
      const classification = classifications.find(
        (c) => c.signal_id === signal.id
      );
      if (!classification || !signal.external_id) continue;

      const labelKey = classifyToLabelKey({
        urgencyScore: classification.urgency_score,
        requiresResponse: classification.requires_response,
        ownershipSignal: classification.ownership_signal,
        escalationLevel: classification.escalation_level,
      });

      await applyZoeLabel(
        connection.id,
        signal.external_id,
        labelIds,
        labelKey
      );
    }
  } catch (err) {
    console.error("Gmail label sync error:", err);
  }
}

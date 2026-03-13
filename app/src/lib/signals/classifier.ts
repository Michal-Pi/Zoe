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
  type HeuristicResult,
} from "@/lib/scoring/heuristic-classifier";

const BATCH_SIZE = 15;

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function clampUrgencyScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

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
    .limit(BATCH_SIZE * 3); // Process up to 3 batches per run

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

  const redis = getRedis();
  const CACHE_TTL = 86400; // 24 hours

  let classified = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  // ── Phase 2: Heuristic pre-filter ──────────────────────────────
  // Run deterministic heuristics on all signals first.
  // High-confidence results skip Haiku entirely.
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

  // Write heuristic-classified signals directly to DB
  if (heuristicAccepted.length > 0) {
    const heuristicClassifications: BatchClassification["classifications"] = [];

    for (const result of heuristicAccepted) {
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
        const message = `heuristic signal update failed for ${result.signal_id}: ${getErrorMessage(updateError)}`;
        errorDetails.push(message);
        errors++;
      } else {
        classified++;
        heuristicClassifications.push({
          signal_id: result.signal_id,
          urgency_score: result.urgency_score,
          topic_cluster: result.topic_cluster,
          ownership_signal: result.ownership_signal,
          requires_response: result.requires_response,
          escalation_level: result.escalation_level,
        });
      }
    }

    // Apply Gmail labels to heuristic-classified signals
    const heuristicBatchSignals = signals.filter((s) =>
      heuristicAccepted.some((h) => h.signal_id === s.id)
    );
    await applyGmailLabels(
      userId,
      heuristicBatchSignals,
      heuristicClassifications,
      supabase
    );

    // Log heuristic usage (zero LLM tokens)
    logLLMUsage({
      model: "heuristic",
      operation: "classify_heuristic",
      inputTokens: 0,
      outputTokens: 0,
      userId,
      metadata: {
        count: heuristicAccepted.length,
        skippedLLM: true,
      },
    });
  }

  // ── LLM classification for low-confidence signals ──────────────
  // Re-map back to the original signal objects for the LLM path
  const llmSignalIds = new Set(llmSignals.map((s) => s.id));
  const signalsForLLM = signals.filter((s) => llmSignalIds.has(s.id));

  for (let i = 0; i < signalsForLLM.length; i += BATCH_SIZE) {
    const batch = signalsForLLM.slice(i, i + BATCH_SIZE);

    try {
      // Check cache for each signal in the batch
      const cachedResults: Map<
        string,
        BatchClassification["classifications"][number]
      > = new Map();
      const uncachedSignals: typeof batch = [];

      if (redis) {
        for (const signal of batch) {
          const cacheKey = `classify:${signal.source}:${signal.id}`;
          let cached;
          try {
            cached = await redis.get<
              BatchClassification["classifications"][number]
            >(cacheKey);
          } catch (err) {
            const message = `redis.get failed for ${cacheKey}: ${getErrorMessage(err)}`;
            console.error("Classification cache read error:", {
              userId,
              signalId: signal.id,
              cacheKey,
              error: getErrorMessage(err),
            });
            errorDetails.push(message);
            throw err;
          }
          if (cached) {
            cachedResults.set(signal.id, cached);
          } else {
            uncachedSignals.push(signal);
          }
        }
      } else {
        uncachedSignals.push(...batch);
      }

      // Call LLM only for uncached signals
      let llmClassifications: BatchClassification["classifications"] = [];

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

        let object;
        try {
          let classifyUsage;
          ({ object, usage: classifyUsage } = await generateObject({
            model: models.fast,
            schema: batchClassificationSchema,
            prompt,
          }));
          if (classifyUsage) {
            logLLMUsage({
              model: "claude-haiku-4-5-latest",
              operation: "classify_signals",
              inputTokens: classifyUsage.inputTokens ?? 0,
              outputTokens: classifyUsage.outputTokens ?? 0,
              userId,
              metadata: { batchSize: uncachedSignals.length },
            });
          }
        } catch (err) {
          const message = `generateObject failed for batch starting ${batch[0]?.id}: ${getErrorMessage(err)}`;
          console.error("Classification model error:", {
            userId,
            batchSignalIds: batch.map((signal) => signal.id),
            uncachedSignalIds: uncachedSignals.map((signal) => signal.id),
            error: getErrorMessage(err),
          });
          errorDetails.push(message);
          throw err;
        }

        llmClassifications = object.classifications;

        // Cache new LLM results
        if (redis) {
          for (const classification of llmClassifications) {
            const signal = uncachedSignals.find(
              (s) => s.id === classification.signal_id
            );
            if (signal) {
              const cacheKey = `classify:${signal.source}:${signal.id}`;
              try {
                await redis.set(cacheKey, classification, { ex: CACHE_TTL });
              } catch (err) {
                const message = `redis.set failed for ${cacheKey}: ${getErrorMessage(err)}`;
                console.error("Classification cache write error:", {
                  userId,
                  signalId: signal.id,
                  cacheKey,
                  error: getErrorMessage(err),
                });
                errorDetails.push(message);
                throw err;
              }
            }
          }
        }
      }

      // Merge cached + fresh results
      const allClassifications = [
        ...llmClassifications,
        ...Array.from(cachedResults.values()),
      ];

      // Update each signal with classification results
      for (const classification of allClassifications) {
        const { signal_id, ...fields } = classification;
        const { error: updateError } = await supabase
          .from("signals")
          .update({
            urgency_score: clampUrgencyScore(fields.urgency_score),
            topic_cluster: fields.topic_cluster,
            ownership_signal: fields.ownership_signal,
            requires_response: fields.requires_response,
            escalation_level: fields.escalation_level,
            classified_at: new Date().toISOString(),
          })
          .eq("id", signal_id)
          .eq("user_id", userId);

        if (updateError) {
          const message = `signal update failed for ${signal_id}: ${getErrorMessage(updateError)}`;
          console.error("Classification signal update error:", {
            userId,
            signalId: signal_id,
            error: getErrorMessage(updateError),
          });
          errorDetails.push(message);
          errors++;
        } else {
          classified++;
        }
      }

      // Apply Gmail labels to classified email signals
      await applyGmailLabels(userId, batch, allClassifications, supabase);
    } catch (err) {
      console.error("Classification batch error:", {
        userId,
        batchSignalIds: batch.map((signal) => signal.id),
        error: getErrorMessage(err),
      });
      errors += batch.length;
    }
  }

  return { classified, errors, errorDetails: errorDetails.slice(0, 10) };
}

/** Apply Zoe Gmail labels to classified email signals (best-effort, non-blocking) */
async function applyGmailLabels(
  userId: string,
  batch: Array<{ id: string; source: string; external_id?: string }>,
  classifications: BatchClassification["classifications"],
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>
): Promise<void> {
  // Only process Gmail signals
  const gmailSignals = batch.filter((s) => s.source === "gmail" && s.external_id);
  if (!gmailSignals.length) return;

  try {
    // Get user's active Google connection
    const { data: connection } = await supabase
      .from("integration_connections")
      .select("id")
      .eq("user_id", userId)
      .eq("provider", "google")
      .eq("status", "active")
      .limit(1)
      .single();

    if (!connection) return;

    // Get or create label IDs
    let labelIds = await getCachedLabelIds(connection.id);
    if (!labelIds) {
      labelIds = await ensureZoeLabels(connection.id);
      await cacheLabelIds(connection.id, labelIds);
    }

    // Apply labels to each classified Gmail signal
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
    // Label application is best-effort — don't fail classification
    console.error("Gmail label sync error:", err);
  }
}

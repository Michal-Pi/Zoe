import { generateObject } from "ai";
import { models } from "@/lib/ai/providers";
import {
  batchClassificationSchema,
  type BatchClassification,
} from "@/lib/ai/schemas/classification";
import { buildClassificationPrompt } from "@/lib/ai/prompts/classify-signals";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getRedis } from "@/lib/cache/redis";
import {
  classifyToLabelKey,
  applyZoeLabel,
  ensureZoeLabels,
  getCachedLabelIds,
  cacheLabelIds,
} from "@/lib/integrations/gmail-labels";

const BATCH_SIZE = 15;

/** Classify unclassified signals for a user */
export async function classifySignals(userId: string): Promise<{
  classified: number;
  errors: number;
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

  if (error || !signals?.length) return { classified: 0, errors: 0 };

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

  // Process in batches
  for (let i = 0; i < signals.length; i += BATCH_SIZE) {
    const batch = signals.slice(i, i + BATCH_SIZE);

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
          const cached = await redis.get<
            BatchClassification["classifications"][number]
          >(cacheKey);
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

        const { object } = await generateObject({
          model: models.fast,
          schema: batchClassificationSchema,
          prompt,
        });

        llmClassifications = object.classifications;

        // Cache new LLM results
        if (redis) {
          for (const classification of llmClassifications) {
            const signal = uncachedSignals.find(
              (s) => s.id === classification.signal_id
            );
            if (signal) {
              const cacheKey = `classify:${signal.source}:${signal.id}`;
              await redis.set(cacheKey, classification, { ex: CACHE_TTL });
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
            urgency_score: fields.urgency_score,
            topic_cluster: fields.topic_cluster,
            ownership_signal: fields.ownership_signal,
            requires_response: fields.requires_response,
            escalation_level: fields.escalation_level,
            classified_at: new Date().toISOString(),
          })
          .eq("id", signal_id)
          .eq("user_id", userId);

        if (updateError) {
          errors++;
        } else {
          classified++;
        }
      }

      // Apply Gmail labels to classified email signals
      await applyGmailLabels(userId, batch, allClassifications, supabase);
    } catch (err) {
      console.error("Classification batch error:", err);
      errors += batch.length;
    }
  }

  return { classified, errors };
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

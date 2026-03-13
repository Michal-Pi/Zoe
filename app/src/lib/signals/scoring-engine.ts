import { generateObject } from "ai";
import { models } from "@/lib/ai/providers";
import { clusterResultSchema } from "@/lib/ai/schemas/scoring";
import { buildClusterPrompt } from "@/lib/ai/prompts/cluster-signals";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { logLLMUsage } from "@/lib/monitoring/llm-costs";
import { createActivitiesFromWorkObjects } from "@/lib/scoring/deterministic-activities";

const MAX_EXTRACTION_ATTEMPTS = 3;

type ScoringSignal = {
  id: string;
  source: string;
  source_type: string;
  thread_id: string | null;
  title: string | null;
  snippet: string | null;
  sender_name: string | null;
  sender_email: string | null;
  topic_cluster: string | null;
  urgency_score: number | null;
  ownership_signal: string | null;
  requires_response: boolean | null;
  escalation_level: string | null;
  received_at: string;
};

type ExtractionWorkObject = {
  id: string;
  title: string;
  description: string | null;
  signalIds: string[];
  sourceKey: string | null;
};

function clampRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

function getThreadSourceKey(signal: Pick<ScoringSignal, "source" | "thread_id">): string | null {
  if (!signal.thread_id) return null;
  if (signal.source !== "gmail" && signal.source !== "slack") return null;
  return `${signal.source}:${signal.thread_id}`;
}

function buildThreadWorkObjectTitle(signals: ScoringSignal[]): string {
  const latestSignal = [...signals].sort(
    (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
  )[0];

  if (latestSignal?.source === "gmail") {
    return latestSignal.title?.trim() || latestSignal.topic_cluster?.trim() || "Email thread";
  }

  if (latestSignal?.source === "slack") {
    const channelTitle = latestSignal.title?.trim();
    const topic = latestSignal.topic_cluster?.trim();
    return topic || channelTitle || "Slack thread";
  }

  return latestSignal?.title?.trim() || latestSignal?.topic_cluster?.trim() || "Work thread";
}

function buildThreadWorkObjectDescription(signals: ScoringSignal[]): string | null {
  const latestSignal = [...signals].sort(
    (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
  )[0];
  const topic = latestSignal?.topic_cluster?.trim();
  if (topic) return `Thread-backed work object for ${topic}.`;
  if (latestSignal?.source === "gmail") return "Thread-backed work object for a Gmail conversation.";
  if (latestSignal?.source === "slack") return "Thread-backed work object for a Slack conversation.";
  return null;
}

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildActivityDedupeKey(
  workObject: ExtractionWorkObject,
  activity: {
    title: string;
    batch_key: string | null;
  }
): string {
  if (workObject.sourceKey) {
    return `thread:${workObject.id}`;
  }

  if (activity.batch_key) {
    return `batch:${activity.batch_key}`;
  }

  return `activity:${workObject.id}:${slugifyTitle(activity.title)}`;
}

// Cluster classified signals into work objects, then extract scored activities
export async function runScoringEngine(userId: string): Promise<{
  clustered: number;
  activitiesCreated: number;
  errors: number;
  errorDetails: string[];
}> {
  const supabase = await createServiceRoleClient();
  let errors = 0;
  const errorDetails: string[] = [];

  // 1. Fetch classified signals not yet linked to a work object
  const { data: unclustered, error: fetchErr } = await supabase
    .from("signals")
    .select(
      "id, source, source_type, thread_id, title, snippet, sender_name, sender_email, topic_cluster, urgency_score, ownership_signal, requires_response, escalation_level, received_at"
    )
    .eq("user_id", userId)
    .not("classified_at", "is", null)
    .order("received_at", { ascending: false })
    .limit(50);

  if (fetchErr || !unclustered?.length) {
    return {
      clustered: 0,
      activitiesCreated: 0,
      errors: 0,
      errorDetails: fetchErr ? [getErrorMessage(fetchErr)] : [],
    };
  }

  // Filter to only signals not yet in work_object_signals
  const { data: alreadyLinked } = await supabase
    .from("work_object_signals")
    .select("signal_id")
    .in(
      "signal_id",
      unclustered.map((s) => s.id)
    );

  const linkedIds = new Set(alreadyLinked?.map((l) => l.signal_id) ?? []);
  const newSignals = unclustered.filter((s) => !linkedIds.has(s.id));

  // 2. Fetch existing active work objects for this user
  const { data: existingWOs } = await supabase
    .from("work_objects")
    .select("id, title, description, source_key, updated_at, extraction_attempts")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(20);

  // 4. Upsert work objects and link signals
  let clustered = 0;
  const workObjectsForExtraction: ExtractionWorkObject[] = [];
  const threadGroups = new Map<string, ScoringSignal[]>();
  const nonThreadSignals: ScoringSignal[] = [];

  for (const signal of newSignals) {
    const sourceKey = getThreadSourceKey(signal as ScoringSignal);
    if (!sourceKey) {
      nonThreadSignals.push(signal as ScoringSignal);
      continue;
    }

    const current = threadGroups.get(sourceKey) ?? [];
    current.push(signal as ScoringSignal);
    threadGroups.set(sourceKey, current);
  }

  const existingWorkObjectsBySourceKey = new Map(
    (existingWOs ?? [])
      .filter((workObject) => Boolean(workObject.source_key))
      .map((workObject) => [workObject.source_key as string, workObject])
  );

  for (const [sourceKey, threadSignals] of threadGroups.entries()) {
    const title = buildThreadWorkObjectTitle(threadSignals);
    const description = buildThreadWorkObjectDescription(threadSignals);
    const latestSignalAt = threadSignals.reduce((latest, signal) => {
      return new Date(signal.received_at) > new Date(latest) ? signal.received_at : latest;
    }, threadSignals[0].received_at);

    let workObjectId = existingWorkObjectsBySourceKey.get(sourceKey)?.id ?? null;

    if (!workObjectId) {
      const { data: createdWorkObject, error: createErr } = await supabase
        .from("work_objects")
        .insert({
          user_id: userId,
          title,
          description,
          signal_count: threadSignals.length,
          latest_signal_at: latestSignalAt,
          source_key: sourceKey,
        })
        .select("id")
        .single();

      if (createErr || !createdWorkObject) {
        errors++;
        errorDetails.push(
          `thread work object create failed for "${sourceKey}": ${getErrorMessage(createErr)}`
        );
        continue;
      }

      workObjectId = createdWorkObject.id;
    } else {
      await supabase
        .from("work_objects")
        .update({
          title,
          description,
          latest_signal_at: latestSignalAt,
          updated_at: new Date().toISOString(),
          extraction_attempts: 0,
          extraction_failed_at: null,
        })
        .eq("id", workObjectId);
    }

    const links = threadSignals.map((signal) => ({
      work_object_id: workObjectId,
      signal_id: signal.id,
    }));

    const { error: linkErr } = await supabase
      .from("work_object_signals")
      .upsert(links, { onConflict: "work_object_id,signal_id" });

    if (linkErr) {
      errors++;
      errorDetails.push(
        `thread work object link failed for ${sourceKey}: ${getErrorMessage(linkErr)}`
      );
      continue;
    }

    const { count: signalCount } = await supabase
      .from("work_object_signals")
      .select("signal_id", { count: "exact", head: true })
      .eq("work_object_id", workObjectId);

    await supabase
      .from("work_objects")
      .update({
        signal_count: signalCount ?? threadSignals.length,
        latest_signal_at: latestSignalAt,
      })
      .eq("id", workObjectId);

    clustered += threadSignals.length;
    workObjectsForExtraction.push({
      id: workObjectId,
      title,
      description,
      signalIds: threadSignals.map((signal) => signal.id),
      sourceKey,
    });
  }

  const existingNonThreadWOs =
    existingWOs?.filter((workObject) => !workObject.source_key) ?? [];

  if (nonThreadSignals.length) {
    const clusterPrompt = buildClusterPrompt(
      nonThreadSignals.map((s) => ({
        id: s.id,
        source: s.source,
        sourceType: s.source_type,
        title: s.title,
        snippet: s.snippet,
        senderName: s.sender_name,
        receivedAt: s.received_at,
      })),
      existingNonThreadWOs.map((workObject) => ({
        id: workObject.id,
        title: workObject.title,
      }))
    );

    let clusterResult;
    try {
      const { object, usage: clusterUsage } = await generateObject({
        model: models.fast,
        schema: clusterResultSchema,
        prompt: clusterPrompt,
      });
      clusterResult = object;
      if (clusterUsage) {
        logLLMUsage({
          model: "claude-haiku-4-5-latest",
          operation: "cluster_signals",
          inputTokens: clusterUsage.inputTokens ?? 0,
          outputTokens: clusterUsage.outputTokens ?? 0,
          userId,
          metadata: { signalCount: nonThreadSignals.length },
        });
      }
    } catch (err) {
      const message = `clustering failed: ${getErrorMessage(err)}`;
      console.error("Clustering error:", {
        userId,
        signalIds: nonThreadSignals.map((signal) => signal.id),
        error: getErrorMessage(err),
      });
      return {
        clustered: 0,
        activitiesCreated: 0,
        errors: 1,
        errorDetails: [message],
      };
    }

    for (const cluster of clusterResult.clusters) {
      const existingMatch = existingNonThreadWOs.find(
        (wo) => cluster.title.toLowerCase() === wo.title.toLowerCase()
      );

      let workObjectId: string;

      if (existingMatch) {
        workObjectId = existingMatch.id;
        const { count: existingCount } = await supabase
          .from("work_object_signals")
          .select("signal_id", { count: "exact", head: true })
          .eq("work_object_id", existingMatch.id);

        await supabase
          .from("work_objects")
          .update({
            signal_count: (existingCount ?? 0) + cluster.signal_ids.length,
            latest_signal_at: new Date().toISOString(),
            extraction_attempts: 0,
            extraction_failed_at: null,
          })
          .eq("id", existingMatch.id);
      } else {
        const { data: newWO, error: createErr } = await supabase
          .from("work_objects")
          .insert({
            user_id: userId,
            title: cluster.title,
            description: cluster.description,
            signal_count: cluster.signal_ids.length,
            latest_signal_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (createErr || !newWO) {
          errors++;
          errorDetails.push(
            `work object create failed for "${cluster.title}": ${getErrorMessage(createErr)}`
          );
          continue;
        }
        workObjectId = newWO.id;
      }

      const links = cluster.signal_ids.map((signalId) => ({
        work_object_id: workObjectId,
        signal_id: signalId,
      }));

      const { error: linkErr } = await supabase
        .from("work_object_signals")
        .upsert(links, { onConflict: "work_object_id,signal_id" });

      if (linkErr) {
        errors++;
        errorDetails.push(
          `work object link failed for ${workObjectId}: ${getErrorMessage(linkErr)}`
        );
      } else {
        clustered += cluster.signal_ids.length;
      }

      workObjectsForExtraction.push({
        id: workObjectId,
        title: cluster.title,
        description: cluster.description,
        signalIds: cluster.signal_ids,
        sourceKey: null,
      });
    }
  }

  // 5. Extract activities from new work objects and from any existing
  // work objects that never got activities due to a prior failed run.
  const { data: workObjectsWithActivities } = await supabase
    .from("activities")
    .select("work_object_id")
    .eq("user_id", userId)
    .not("work_object_id", "is", null);

  const workObjectIdsWithActivities = new Set(
    (workObjectsWithActivities ?? [])
      .map((row) => row.work_object_id)
      .filter((value): value is string => Boolean(value))
  );

  const retryWorkObjects =
    existingWOs?.filter(
      (wo) =>
        !workObjectIdsWithActivities.has(wo.id) &&
        (wo.extraction_attempts ?? 0) < MAX_EXTRACTION_ATTEMPTS
    ) ?? [];

  const extractionCandidates = new Map<
    string,
    ExtractionWorkObject
  >();

  for (const workObject of workObjectsForExtraction) {
    extractionCandidates.set(workObject.id, workObject);
  }

  if (retryWorkObjects.length) {
    const { data: retryLinks } = await supabase
      .from("work_object_signals")
      .select("work_object_id, signal_id")
      .in(
        "work_object_id",
        retryWorkObjects.map((wo) => wo.id)
      );

    const signalIdsByWorkObject = new Map<string, string[]>();
    for (const link of retryLinks ?? []) {
      const current = signalIdsByWorkObject.get(link.work_object_id) ?? [];
      current.push(link.signal_id);
      signalIdsByWorkObject.set(link.work_object_id, current);
    }

    for (const workObject of retryWorkObjects) {
      const signalIds = signalIdsByWorkObject.get(workObject.id) ?? [];
      if (!signalIds.length) continue;
      extractionCandidates.set(workObject.id, {
        id: workObject.id,
        title: workObject.title,
        description: null,
        signalIds,
        sourceKey: null,
      });
    }
  }

  // Fetch user priorities
  const { data: priorities } = await supabase
    .from("strategic_priorities")
    .select("title")
    .eq("user_id", userId)
    .order("sort_order");

  const priorityTitles = priorities?.map((p) => p.title) ?? [];

  const extractionWorkObjects = Array.from(extractionCandidates.values());
  if (!extractionWorkObjects.length) {
    return { clustered, activitiesCreated: 0, errors, errorDetails: errorDetails.slice(0, 10) };
  }

  // Fetch signals for extraction — need full classification fields
  const allSignalIds = Array.from(
    new Set(extractionWorkObjects.flatMap((wo) => wo.signalIds))
  );

  const { data: extractionSignals } = await supabase
    .from("signals")
    .select(
      "id, source, source_type, title, snippet, sender_name, sender_email, urgency_score, ownership_signal, requires_response, escalation_level, topic_cluster, received_at"
    )
    .in("id", allSignalIds);

  const extractionSignalsById = new Map(
    (extractionSignals ?? []).map((signal) => [signal.id, signal])
  );

  // Build work object inputs with full signal data for deterministic scoring
  const woInputs = extractionWorkObjects.map((wo) => {
    const signals = wo.signalIds
      .map((signalId) => extractionSignalsById.get(signalId))
      .filter((signal): signal is NonNullable<typeof signal> => Boolean(signal));

    return {
      id: wo.id,
      title: wo.title,
      description: wo.description,
      sourceKey: wo.sourceKey,
      signals,
    };
  });

  // Create activities deterministically — no LLM call
  const generatedActivities = createActivitiesFromWorkObjects(
    woInputs,
    priorityTitles
  );

  let activitiesCreated = 0;

  // Deduplicate against existing activities
  const dedupeCandidates = generatedActivities.map((activity) => {
    const wo = extractionWorkObjects.find((candidate) => candidate.id === activity.work_object_id);
    if (!wo) return null;
    return buildActivityDedupeKey(wo, activity);
  }).filter((value): value is string => Boolean(value));

  const existingActiveActivitiesByDedupeKey = new Map<string, { id: string; status: string }>();

  if (dedupeCandidates.length) {
    const { data: existingActivities } = await supabase
      .from("activities")
      .select("id, dedupe_key, status")
      .eq("user_id", userId)
      .in("status", ["pending", "in_progress", "snoozed"])
      .in("dedupe_key", Array.from(new Set(dedupeCandidates)));

    for (const existing of existingActivities ?? []) {
      if (!existing.dedupe_key) continue;
      existingActiveActivitiesByDedupeKey.set(existing.dedupe_key, {
        id: existing.id,
        status: existing.status,
      });
    }
  }

  // Insert or update activities
  for (const activity of generatedActivities) {
    const wo = extractionWorkObjects.find(
      (candidate) => candidate.id === activity.work_object_id
    );
    if (!wo) {
      errors++;
      errorDetails.push(
        `activity resolution failed for "${activity.title}": no work object matched`
      );
      continue;
    }

    const dedupeKey = buildActivityDedupeKey(wo, activity);
    const activityPayload = {
      work_object_id: activity.work_object_id,
      title: activity.title,
      description: activity.description,
      time_estimate_minutes: activity.time_estimate_minutes,
      score: activity.score,
      score_rationale: activity.score_rationale,
      scoring_factors: activity.scoring_factors,
      horizon: activity.horizon,
      trigger_description: activity.trigger_description,
      deadline_at: activity.deadline_at,
      batch_key: activity.batch_key,
      batch_label: activity.batch_label,
      dedupe_key: dedupeKey,
      scored_at: new Date().toISOString(),
    };

    const existingActivity = existingActiveActivitiesByDedupeKey.get(dedupeKey);
    if (existingActivity) {
      const { error: updateErr } = await supabase
        .from("activities")
        .update(activityPayload)
        .eq("id", existingActivity.id)
        .eq("user_id", userId);

      if (updateErr) {
        errors++;
        errorDetails.push(
          `activity update failed for "${activity.title}": ${getErrorMessage(updateErr)}`
        );
      }
      continue;
    }

    const { data: insertedActivity, error: insertErr } = await supabase
      .from("activities")
      .insert({
        user_id: userId,
        ...activityPayload,
      })
      .select("id")
      .single();

    if (insertErr && isUniqueViolation(insertErr)) {
      const { data: concurrentActivity } = await supabase
        .from("activities")
        .select("id")
        .eq("user_id", userId)
        .eq("dedupe_key", dedupeKey)
        .in("status", ["pending", "in_progress", "snoozed"])
        .limit(1)
        .single();

      if (concurrentActivity) {
        const { error: recoveryUpdateErr } = await supabase
          .from("activities")
          .update(activityPayload)
          .eq("id", concurrentActivity.id)
          .eq("user_id", userId);

        if (recoveryUpdateErr) {
          errors++;
          errorDetails.push(
            `activity recovery update failed for "${activity.title}": ${getErrorMessage(
              recoveryUpdateErr
            )}`
          );
        } else {
          existingActiveActivitiesByDedupeKey.set(dedupeKey, {
            id: concurrentActivity.id,
            status: "pending",
          });
        }
        continue;
      }
    }

    if (insertErr || !insertedActivity) {
      errors++;
      errorDetails.push(
        `activity insert failed for "${activity.title}": ${getErrorMessage(insertErr)}`
      );
    } else {
      activitiesCreated++;
      existingActiveActivitiesByDedupeKey.set(dedupeKey, {
        id: insertedActivity.id,
        status: "pending",
      });
    }
  }

  // Increment extraction_attempts for all candidates and mark failures at cap
  const allCandidateIds = Array.from(extractionCandidates.keys());
  if (allCandidateIds.length) {
    for (const woId of allCandidateIds) {
      const currentAttempts =
        (existingWOs?.find((wo) => wo.id === woId)?.extraction_attempts ?? 0) + 1;

      const updatePayload: Record<string, unknown> = {
        extraction_attempts: currentAttempts,
      };

      if (currentAttempts >= MAX_EXTRACTION_ATTEMPTS) {
        updatePayload.extraction_failed_at = new Date().toISOString();
        console.warn("Work object hit extraction retry cap:", {
          userId,
          workObjectId: woId,
          attempts: currentAttempts,
        });
      }

      await supabase
        .from("work_objects")
        .update(updatePayload)
        .eq("id", woId);
    }
  }

  return { clustered, activitiesCreated, errors, errorDetails: errorDetails.slice(0, 10) };
}

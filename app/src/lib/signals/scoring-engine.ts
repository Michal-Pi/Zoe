import { generateObject } from "ai";
import { models } from "@/lib/ai/providers";
import { clusterResultSchema } from "@/lib/ai/schemas/scoring";
import { activityExtractionSchema } from "@/lib/ai/schemas/scoring";
import { buildClusterPrompt } from "@/lib/ai/prompts/cluster-signals";
import { buildActivityExtractionPrompt } from "@/lib/ai/prompts/extract-activities";
import { createServiceRoleClient } from "@/lib/supabase/server";

// Cluster classified signals into work objects, then extract scored activities
export async function runScoringEngine(userId: string): Promise<{
  clustered: number;
  activitiesCreated: number;
  errors: number;
}> {
  const supabase = await createServiceRoleClient();
  let errors = 0;

  // 1. Fetch classified signals not yet linked to a work object
  const { data: unclustered, error: fetchErr } = await supabase
    .from("signals")
    .select(
      "id, source, source_type, title, snippet, sender_name, sender_email, topic_cluster, urgency_score, ownership_signal, requires_response, escalation_level, received_at"
    )
    .eq("user_id", userId)
    .not("classified_at", "is", null)
    .order("received_at", { ascending: false })
    .limit(50);

  if (fetchErr || !unclustered?.length) return { clustered: 0, activitiesCreated: 0, errors: 0 };

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

  if (!newSignals.length) return { clustered: 0, activitiesCreated: 0, errors: 0 };

  // 2. Fetch existing active work objects for this user
  const { data: existingWOs } = await supabase
    .from("work_objects")
    .select("id, title")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(20);

  // 3. Cluster signals into work objects using AI
  const clusterPrompt = buildClusterPrompt(
    newSignals.map((s) => ({
      id: s.id,
      source: s.source,
      sourceType: s.source_type,
      title: s.title,
      snippet: s.snippet,
      senderName: s.sender_name,
      senderEmail: s.sender_email,
      topicCluster: s.topic_cluster,
      urgencyScore: s.urgency_score,
      ownershipSignal: s.ownership_signal,
      requiresResponse: s.requires_response,
      receivedAt: s.received_at,
    })),
    existingWOs ?? []
  );

  let clusterResult;
  try {
    const { object } = await generateObject({
      model: models.fast,
      schema: clusterResultSchema,
      prompt: clusterPrompt,
    });
    clusterResult = object;
  } catch (err) {
    console.error("Clustering error:", err);
    return { clustered: 0, activitiesCreated: 0, errors: 1 };
  }

  // 4. Upsert work objects and link signals
  let clustered = 0;
  const workObjectsForExtraction: {
    id: string;
    title: string;
    description: string | null;
    signalIds: string[];
  }[] = [];

  for (const cluster of clusterResult.clusters) {
    // Check if this cluster matches an existing work object (by title from AI)
    const existingMatch = existingWOs?.find(
      (wo) => cluster.title.toLowerCase() === wo.title.toLowerCase()
    );

    let workObjectId: string;

    if (existingMatch) {
      // Update existing work object
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
        })
        .eq("id", existingMatch.id);
    } else {
      // Create new work object
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
        continue;
      }
      workObjectId = newWO.id;
    }

    // Link signals to work object
    const links = cluster.signal_ids.map((signalId) => ({
      work_object_id: workObjectId,
      signal_id: signalId,
    }));

    const { error: linkErr } = await supabase
      .from("work_object_signals")
      .upsert(links, { onConflict: "work_object_id,signal_id" });

    if (linkErr) {
      errors++;
    } else {
      clustered += cluster.signal_ids.length;
    }

    workObjectsForExtraction.push({
      id: workObjectId,
      title: cluster.title,
      description: cluster.description,
      signalIds: cluster.signal_ids,
    });
  }

  // 5. Extract activities from the new/updated work objects
  // Fetch user priorities
  const { data: priorities } = await supabase
    .from("strategic_priorities")
    .select("title")
    .eq("user_id", userId)
    .order("sort_order");

  const priorityTitles = priorities?.map((p) => p.title) ?? [];

  // Build extraction input — include signal details for each work object
  const woForExtraction = workObjectsForExtraction.map((wo) => {
    const signalDetails = newSignals
      .filter((s) => wo.signalIds.includes(s.id))
      .map((s) => ({
        source: s.source,
        sourceType: s.source_type,
        title: s.title,
        snippet: s.snippet,
        senderName: s.sender_name,
        urgencyScore: s.urgency_score,
        ownershipSignal: s.ownership_signal,
        requiresResponse: s.requires_response,
        escalationLevel: s.escalation_level,
        receivedAt: s.received_at,
      }));

    return {
      id: wo.id,
      title: wo.title,
      description: wo.description,
      signals: signalDetails,
    };
  });

  // Only extract if we have work objects with signals
  if (!woForExtraction.length)
    return { clustered, activitiesCreated: 0, errors };

  const extractionPrompt = buildActivityExtractionPrompt(
    woForExtraction,
    priorityTitles,
    new Date().toISOString()
  );

  let activitiesCreated = 0;

  try {
    const { object } = await generateObject({
      model: models.standard,
      schema: activityExtractionSchema,
      prompt: extractionPrompt,
    });

    // Insert activities — match to correct work object by batch_key or title
    for (const activity of object.activities) {
      const matchedWO = woForExtraction.find(
        (wo) =>
          activity.batch_key === wo.id ||
          wo.title.toLowerCase().includes(activity.title.toLowerCase().slice(0, 20)) ||
          activity.title.toLowerCase().includes(wo.title.toLowerCase().slice(0, 20))
      );
      const { error: insertErr } = await supabase.from("activities").insert({
        user_id: userId,
        work_object_id: matchedWO?.id ?? woForExtraction[0]?.id ?? null,
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
        scored_at: new Date().toISOString(),
      });

      if (insertErr) {
        errors++;
      } else {
        activitiesCreated++;
      }
    }
  } catch (err) {
    console.error("Activity extraction error:", err);
    errors++;
  }

  return { clustered, activitiesCreated, errors };
}

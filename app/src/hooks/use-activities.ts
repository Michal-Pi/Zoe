"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Activity } from "@/domain/signals";

function mapRow(row: Record<string, unknown>): Activity {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    workObjectId: row.work_object_id as string | null,
    title: row.title as string,
    description: row.description as string | null,
    timeEstimateMinutes: row.time_estimate_minutes as number | null,
    score: row.score as number,
    scoreRationale: row.score_rationale as string[] | null,
    scoringFactors: row.scoring_factors as Record<string, number> | null,
    horizon: row.horizon as Activity["horizon"],
    triggerDescription: row.trigger_description as string | null,
    triggerAt: row.trigger_at as string | null,
    deadlineAt: row.deadline_at as string | null,
    status: row.status as Activity["status"],
    startedAt: row.started_at as string | null,
    completedAt: row.completed_at as string | null,
    snoozedUntil: row.snoozed_until as string | null,
    isPinned: row.is_pinned as boolean,
    batchKey: row.batch_key as string | null,
    batchLabel: row.batch_label as string | null,
    parentActivityId: row.parent_activity_id as string | null,
    scoredAt: row.scored_at as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function useActivities() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .in("status", ["pending", "in_progress"])
        .order("is_pinned", { ascending: false })
        .order("score", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
    refetchInterval: 30_000,
  });
}

export function useUpdateActivity() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<{
        status: Activity["status"];
        is_pinned: boolean;
        snoozed_until: string | null;
      }>;
    }) => {
      const { error } = await supabase
        .from("activities")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

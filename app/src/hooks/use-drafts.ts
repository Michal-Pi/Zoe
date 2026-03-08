"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { DraftReply } from "@/domain/drafts";

function mapRow(row: Record<string, unknown>): DraftReply {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    activityId: row.activity_id as string | null,
    signalId: row.signal_id as string | null,
    meetingId: row.meeting_id as string | null,
    toEmail: row.to_email as string,
    subject: row.subject as string,
    body: row.body as string,
    tone: row.tone as DraftReply["tone"],
    draftType: row.draft_type as DraftReply["draftType"],
    status: row.status as DraftReply["status"],
    editedBody: row.edited_body as string | null,
    sentAt: row.sent_at as string | null,
    discardedAt: row.discarded_at as string | null,
    modelUsed: row.model_used as string,
    promptTokens: row.prompt_tokens as number | null,
    completionTokens: row.completion_tokens as number | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function useDrafts(status: DraftReply["status"] | "all" = "pending") {
  const supabase = createClient();

  return useQuery({
    queryKey: ["drafts", status],
    queryFn: async () => {
      let q = supabase
        .from("draft_replies")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (status !== "all") {
        q = q.eq("status", status);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
    refetchInterval: 30_000,
  });
}

export function useDraftCount() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["drafts", "count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("draft_replies")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });
}

export function useUpdateDraft() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<{
        status: DraftReply["status"];
        edited_body: string | null;
        sent_at: string | null;
        discarded_at: string | null;
      }>;
    }) => {
      const { error } = await supabase
        .from("draft_replies")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
    },
  });
}

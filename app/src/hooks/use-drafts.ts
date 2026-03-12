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

interface DraftContext {
  userEmail: string | null;
  recipientDomain: string | null;
  userDomain: string | null;
  signal: {
    title: string | null;
    snippet: string | null;
    senderName: string | null;
    senderEmail: string | null;
    urgencyScore: number | null;
    requiresResponse: boolean | null;
    receivedAt: string | null;
    source: string | null;
  } | null;
  activity: {
    title: string;
    score: number;
    triggerDescription: string | null;
    horizon: string | null;
  } | null;
  meeting: {
    title: string;
    startAt: string;
    decisionDensity: string | null;
    ownershipLoad: string | null;
    efficiencyRisks: string[] | null;
    prepTimeNeededMinutes: number | null;
  } | null;
}

function getDomain(email: string | null | undefined): string | null {
  if (!email || !email.includes("@")) return null;
  return email.split("@")[1]?.toLowerCase() ?? null;
}

export function useDraftContext(draft: DraftReply | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["draft-context", draft?.id],
    enabled: Boolean(draft),
    queryFn: async (): Promise<DraftContext | null> => {
      if (!draft) return null;

      const [{ data: auth }, signalResult, activityResult, meetingResult] =
        await Promise.all([
          supabase.auth.getUser(),
          draft.signalId
            ? supabase
                .from("signals")
                .select(
                  "title, snippet, sender_name, sender_email, urgency_score, requires_response, received_at, source"
                )
                .eq("id", draft.signalId)
                .single()
            : Promise.resolve({ data: null, error: null }),
          draft.activityId
            ? supabase
                .from("activities")
                .select("title, score, trigger_description, horizon")
                .eq("id", draft.activityId)
                .single()
            : Promise.resolve({ data: null, error: null }),
          draft.meetingId
            ? supabase
                .from("calendar_events")
                .select(
                  "title, start_at, decision_density, ownership_load, efficiency_risks, prep_time_needed_minutes"
                )
                .eq("id", draft.meetingId)
                .single()
            : Promise.resolve({ data: null, error: null }),
        ]);

      const userEmail = auth.user?.email ?? null;

      return {
        userEmail,
        recipientDomain: getDomain(draft.toEmail),
        userDomain: getDomain(userEmail),
        signal: signalResult.data
          ? {
              title: signalResult.data.title,
              snippet: signalResult.data.snippet,
              senderName: signalResult.data.sender_name,
              senderEmail: signalResult.data.sender_email,
              urgencyScore: signalResult.data.urgency_score,
              requiresResponse: signalResult.data.requires_response,
              receivedAt: signalResult.data.received_at,
              source: signalResult.data.source,
            }
          : null,
        activity: activityResult.data
          ? {
              title: activityResult.data.title,
              score: activityResult.data.score,
              triggerDescription: activityResult.data.trigger_description,
              horizon: activityResult.data.horizon,
            }
          : null,
        meeting: meetingResult.data
          ? {
              title: meetingResult.data.title,
              startAt: meetingResult.data.start_at,
              decisionDensity: meetingResult.data.decision_density,
              ownershipLoad: meetingResult.data.ownership_load,
              efficiencyRisks: meetingResult.data.efficiency_risks,
              prepTimeNeededMinutes: meetingResult.data.prep_time_needed_minutes,
            }
          : null,
      };
    },
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

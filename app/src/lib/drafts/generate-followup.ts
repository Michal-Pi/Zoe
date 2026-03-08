import { generateObject } from "ai";
import { models } from "@/lib/ai/providers";
import { followUpDraftSchema } from "@/lib/ai/schemas/draft-reply";
import { buildFollowupPrompt } from "@/lib/ai/prompts/generate-followup";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { logLLMUsage } from "@/lib/monitoring/llm-costs";

/**
 * Generate follow-up email drafts for recently ended meetings.
 * Called by the /api/cron/drafts route.
 */
export async function generateFollowupsForUser(
  userId: string
): Promise<{ generated: number; errors: number }> {
  const supabase = await createServiceRoleClient();

  // Find meetings that ended in the last 2 hours, where user is organizer
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const { data: meetings } = await supabase
    .from("calendar_events")
    .select(
      "id, title, description, start_at, end_at, attendee_count, attendees, decision_density, ownership_load"
    )
    .eq("user_id", userId)
    .eq("is_organizer", true)
    .gte("end_at", twoHoursAgo)
    .lte("end_at", now)
    .gt("attendee_count", 1)
    .order("end_at", { ascending: false })
    .limit(5);

  if (!meetings?.length) return { generated: 0, errors: 0 };

  // Filter out meetings that already have follow-up drafts
  const meetingIds = meetings.map((m: { id: string }) => m.id);
  const { data: existingDrafts } = await supabase
    .from("draft_replies")
    .select("meeting_id")
    .eq("draft_type", "follow_up")
    .in("meeting_id", meetingIds);

  const existingMeetingIds = new Set(
    existingDrafts?.map((d: { meeting_id: string }) => d.meeting_id) ?? []
  );

  const needsFollowup = meetings.filter(
    (m: { id: string }) => !existingMeetingIds.has(m.id)
  );

  if (!needsFollowup.length) return { generated: 0, errors: 0 };

  // Fetch user's writing style
  const { data: profile } = await supabase
    .from("profiles")
    .select("writing_style_notes")
    .eq("id", userId)
    .single();

  const writingStyle = profile?.writing_style_notes ?? null;

  let generated = 0;
  let errors = 0;

  for (const meeting of needsFollowup) {
    try {
      // Get related signals for context (emails/Slack around this meeting's time)
      const meetingStart = new Date(meeting.start_at);
      const lookbackStart = new Date(
        meetingStart.getTime() - 24 * 60 * 60 * 1000
      ).toISOString();

      const { data: relatedSignals } = await supabase
        .from("signals")
        .select(
          "title, snippet, sender_name, topic_cluster, received_at"
        )
        .eq("user_id", userId)
        .gte("received_at", lookbackStart)
        .lte("received_at", meeting.end_at)
        .order("received_at", { ascending: false })
        .limit(10);

      const prompt = buildFollowupPrompt(
        {
          title: meeting.title,
          description: meeting.description,
          startAt: meeting.start_at,
          endAt: meeting.end_at,
          attendees: meeting.attendees,
          attendeeCount: meeting.attendee_count,
          decisionDensity: meeting.decision_density,
          ownershipLoad: meeting.ownership_load,
        },
        (relatedSignals ?? []).map((s: Record<string, string | null>) => ({
          title: s.title,
          snippet: s.snippet,
          senderName: s.sender_name,
          topicCluster: s.topic_cluster,
          receivedAt: s.received_at ?? "",
        })),
        writingStyle
      );

      const { object, usage } = await generateObject({
        model: models.standard,
        schema: followUpDraftSchema,
        prompt,
      });

      // Determine the primary recipient (first attendee)
      const attendees = meeting.attendees as
        | Array<{ email: string; name?: string }>
        | null;
      const toEmail = attendees?.[0]?.email ?? "attendees";

      const { error: insertError } = await supabase
        .from("draft_replies")
        .insert({
          user_id: userId,
          meeting_id: meeting.id,
          to_email: toEmail,
          subject: object.subject,
          body: object.body,
          tone: "professional",
          draft_type: "follow_up",
          status: "pending",
          model_used: "claude-sonnet-4-6",
          prompt_tokens: usage?.inputTokens ?? null,
          completion_tokens: usage?.outputTokens ?? null,
        });

      if (insertError) {
        console.error("Follow-up draft insert error:", insertError);
        errors++;
      } else {
        generated++;

        logLLMUsage({
          model: "claude-sonnet-4-6-latest",
          operation: "draft_followup",
          inputTokens: usage?.inputTokens ?? 0,
          outputTokens: usage?.outputTokens ?? 0,
          userId,
        });
      }
    } catch (err) {
      console.error(
        `Follow-up generation error for meeting ${meeting.id}:`,
        err
      );
      errors++;
    }
  }

  return { generated, errors };
}

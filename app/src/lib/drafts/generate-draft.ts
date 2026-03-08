import { generateObject } from "ai";
import { models } from "@/lib/ai/providers";
import { draftReplySchema } from "@/lib/ai/schemas/draft-reply";
import { buildDraftReplyPrompt } from "@/lib/ai/prompts/generate-draft-reply";
import { getMessageBody } from "@/lib/integrations/gmail";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { logLLMUsage } from "@/lib/monitoring/llm-costs";
import { getRedis } from "@/lib/cache/redis";

const MAX_DRAFTS_PER_RUN = 20;
const DAILY_DRAFT_LIMIT = 20;

interface SignalForDraft {
  id: string;
  external_id: string;
  title: string | null;
  snippet: string | null;
  sender_name: string | null;
  sender_email: string;
  thread_id: string | null;
  urgency_score: number | null;
  requires_response: boolean | null;
}

/**
 * Generate proactive draft replies for high-priority email signals.
 * Called by the /api/cron/drafts route.
 */
export async function generateDraftsForUser(
  userId: string,
  connectionId: string
): Promise<{ generated: number; errors: number }> {
  const supabase = await createServiceRoleClient();

  // Fetch user's writing style + priorities
  const [{ data: profile }, { data: priorities }] = await Promise.all([
    supabase
      .from("profiles")
      .select("writing_style_notes")
      .eq("id", userId)
      .single(),
    supabase
      .from("strategic_priorities")
      .select("title")
      .eq("user_id", userId)
      .order("sort_order"),
  ]);

  const writingStyle = profile?.writing_style_notes ?? null;
  const priorityTitles = priorities?.map((p: { title: string }) => p.title) ?? [];

  // Find email signals that:
  // 1. Require a response (classified)
  // 2. Don't already have a draft
  // 3. Were received in the last 48 hours
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: signals } = await supabase
    .from("signals")
    .select(
      "id, external_id, title, snippet, sender_name, sender_email, thread_id, urgency_score, requires_response"
    )
    .eq("user_id", userId)
    .eq("source", "gmail")
    .eq("requires_response", true)
    .not("classified_at", "is", null)
    .gte("received_at", cutoff)
    .order("urgency_score", { ascending: false })
    .limit(MAX_DRAFTS_PER_RUN);

  if (!signals?.length) return { generated: 0, errors: 0 };

  // Check daily rate limit
  const redis = getRedis();
  if (redis) {
    const rateLimitKey = `drafts:daily:${userId}`;
    const todayCount = (await redis.get<number>(rateLimitKey)) ?? 0;
    if (todayCount >= DAILY_DRAFT_LIMIT) {
      return { generated: 0, errors: 0 };
    }
  }

  // Filter out signals that already have drafts
  const signalIds = signals.map((s: SignalForDraft) => s.id);
  const { data: existingDrafts } = await supabase
    .from("draft_replies")
    .select("signal_id")
    .in("signal_id", signalIds);

  const existingSignalIds = new Set(
    existingDrafts?.map((d: { signal_id: string }) => d.signal_id) ?? []
  );

  const needsDraft = signals.filter(
    (s: SignalForDraft) => !existingSignalIds.has(s.id)
  );

  let generated = 0;
  let errors = 0;

  for (const signal of needsDraft) {
    try {
      // Fetch full email body via Gmail API
      let body: string | null = null;
      try {
        body = await getMessageBody(connectionId, signal.external_id);
      } catch {
        // Fall back to snippet if body fetch fails
      }

      const prompt = buildDraftReplyPrompt(
        {
          senderName: signal.sender_name,
          senderEmail: signal.sender_email,
          subject: signal.title ?? "(no subject)",
          snippet: signal.snippet,
          body,
          threadContext: null,
        },
        priorityTitles,
        writingStyle
      );

      const { object, usage } = await generateObject({
        model: models.standard,
        schema: draftReplySchema,
        prompt,
      });

      // Store the draft
      const { error: insertError } = await supabase
        .from("draft_replies")
        .insert({
          user_id: userId,
          signal_id: signal.id,
          to_email: signal.sender_email,
          subject: object.subject,
          body: object.body,
          tone: object.tone,
          draft_type: "reply",
          status: "pending",
          model_used: "claude-sonnet-4-6",
          prompt_tokens: usage?.inputTokens ?? null,
          completion_tokens: usage?.outputTokens ?? null,
        });

      if (insertError) {
        console.error("Draft insert error:", insertError);
        errors++;
      } else {
        generated++;

        // Log cost
        logLLMUsage({
          model: "claude-sonnet-4-6-latest",
          operation: "draft_reply",
          inputTokens: usage?.inputTokens ?? 0,
          outputTokens: usage?.outputTokens ?? 0,
          userId,
        });

        // Increment daily counter
        if (redis) {
          const rateLimitKey = `drafts:daily:${userId}`;
          await redis.incr(rateLimitKey);
          // Set TTL to expire at midnight UTC (approximate)
          const now = new Date();
          const midnight = new Date(now);
          midnight.setUTCHours(24, 0, 0, 0);
          const ttl = Math.ceil((midnight.getTime() - now.getTime()) / 1000);
          await redis.expire(rateLimitKey, ttl);
        }
      }
    } catch (err) {
      console.error(`Draft generation error for signal ${signal.id}:`, err);
      errors++;
    }
  }

  return { generated, errors };
}

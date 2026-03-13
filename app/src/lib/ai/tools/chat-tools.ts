import { z } from "zod";
import { zodSchema } from "ai";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getMessageBody, sendEmail } from "@/lib/integrations/gmail";
import { sendSlackMessage } from "@/lib/integrations/slack";
import { findAvailableTimes } from "@/lib/calendar/find-available-times";

// Sanitize user input for use in PostgREST filter strings
function sanitizeFilterValue(input: string): string {
  // Remove characters that could break PostgREST filter syntax
  return input.replace(/[%,.()\[\]]/g, "").trim().slice(0, 100);
}

/** Look up the active Google connection ID for a user */
async function getGoogleConnectionId(userId: string): Promise<string | null> {
  const supabase = await createServiceRoleClient();
  const { data } = await supabase
    .from("integration_connections")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", "google")
    .eq("status", "active")
    .limit(1)
    .single();
  return data?.id ?? null;
}

/** Look up the active Slack connection ID for a user */
async function getSlackConnectionId(userId: string): Promise<string | null> {
  const supabase = await createServiceRoleClient();
  const { data } = await supabase
    .from("integration_connections")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", "slack")
    .eq("status", "active")
    .limit(1)
    .single();
  return data?.id ?? null;
}

export function getChatTools(userId: string) {
  return {
    search_signals: {
      description:
        "Search the user's signals (emails, Slack messages, calendar events) by keyword, sender, or topic.",
      inputSchema: zodSchema(
        z.object({
          query: z.string().describe("Search query"),
          source: z
            .enum(["gmail", "slack", "google_calendar", "all"])
            .default("all"),
          limit: z.number().int().min(1).max(20).default(10),
        })
      ),
      execute: async ({
        query,
        source,
        limit,
      }: {
        query: string;
        source: string;
        limit: number;
      }) => {
        const supabase = await createServiceRoleClient();

        const safeQuery = sanitizeFilterValue(query);
        let q = supabase
          .from("signals")
          .select(
            "id, source, title, snippet, sender_name, sender_email, received_at, urgency_score, topic_cluster"
          )
          .eq("user_id", userId)
          .or(
            `title.ilike.%${safeQuery}%,snippet.ilike.%${safeQuery}%,sender_name.ilike.%${safeQuery}%`
          )
          .order("received_at", { ascending: false })
          .limit(limit);

        if (source !== "all") {
          q = q.eq("source", source);
        }

        const { data, error } = await q;
        if (error) return { error: error.message };
        // Truncate snippets to limit tokens fed back into Sonnet
        const trimmed = (data ?? []).map((s) => ({
          ...s,
          snippet: s.snippet ? s.snippet.slice(0, 200) : s.snippet,
        }));
        return { signals: trimmed, count: trimmed.length };
      },
    },

    get_todays_meetings: {
      description:
        "Get today's calendar meetings with classification details.",
      inputSchema: zodSchema(z.object({})),
      execute: async () => {
        const supabase = await createServiceRoleClient();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const { data, error } = await supabase
          .from("calendar_events")
          .select(
            "title, start_at, end_at, attendee_count, is_organizer, decision_density, ownership_load, efficiency_risks, location"
          )
          .eq("user_id", userId)
          .gte("start_at", today.toISOString())
          .lt("start_at", tomorrow.toISOString())
          .order("start_at");

        if (error) return { error: error.message };
        return { meetings: data ?? [], count: data?.length ?? 0 };
      },
    },

    get_top_activities: {
      description:
        "Get the user's highest-priority activities from the Command Center.",
      inputSchema: zodSchema(
        z.object({
          limit: z.number().int().min(1).max(20).default(5),
        })
      ),
      execute: async ({ limit }: { limit: number }) => {
        const supabase = await createServiceRoleClient();

        const { data, error } = await supabase
          .from("activities")
          .select(
            "id, title, description, score, score_rationale, horizon, time_estimate_minutes, status, deadline_at"
          )
          .eq("user_id", userId)
          .in("status", ["pending", "in_progress"])
          .order("score", { ascending: false })
          .limit(limit);

        if (error) return { error: error.message };
        return { activities: data ?? [] };
      },
    },

    get_top_email_signals: {
      description:
        "Get the highest-priority email signals that likely need a response.",
      inputSchema: zodSchema(
        z.object({
          limit: z.number().int().min(1).max(10).default(3),
        })
      ),
      execute: async ({ limit }: { limit: number }) => {
        const supabase = await createServiceRoleClient();

        const { data, error } = await supabase
          .from("signals")
          .select(
            "id, external_id, thread_id, title, snippet, sender_name, sender_email, urgency_score, received_at"
          )
          .eq("user_id", userId)
          .eq("source", "gmail")
          .eq("requires_response", true)
          .not("classified_at", "is", null)
          .order("urgency_score", { ascending: false, nullsFirst: false })
          .order("received_at", { ascending: false })
          .limit(limit);

        if (error) return { error: error.message };

        const emails = data ?? [];
        const topEmail = emails[0] ?? null;

        if (!topEmail) {
          return {
            emails,
            count: 0,
            topEmail: null,
            message:
              "I reviewed your recent email signals but did not find a clear high-priority email that needs a reply.",
          };
        }

        return {
          emails,
          count: emails.length,
          topEmail,
          message: `I picked "${topEmail.title}" from ${topEmail.sender_name || topEmail.sender_email} as the highest-priority email to answer next.`,
        };
      },
    },

    get_email_thread_context: {
      description:
        "Fetch the selected email plus recent thread context so Zoe can draft a better reply.",
      inputSchema: zodSchema(
        z.object({
          signal_id: z.string().describe("The signal ID of the email to review"),
        })
      ),
      execute: async ({ signal_id }: { signal_id: string }) => {
        const supabase = await createServiceRoleClient();

        const { data: signal, error } = await supabase
          .from("signals")
          .select(
            "id, external_id, thread_id, title, snippet, sender_name, sender_email, urgency_score, received_at"
          )
          .eq("user_id", userId)
          .eq("id", signal_id)
          .eq("source", "gmail")
          .single();

        if (error || !signal) {
          return {
            error: error?.message ?? "I could not find that email in your synced signals.",
          };
        }

        let body: string | null = null;
        const connectionId = await getGoogleConnectionId(userId);
        if (connectionId && signal.external_id) {
          try {
            body = await getMessageBody(connectionId, signal.external_id);
          } catch (fetchError) {
            console.error("Failed to fetch email body for chat context:", fetchError);
          }
        }

        let relatedSignals: Array<Record<string, unknown>> = [];
        if (signal.thread_id) {
          const { data: threadSignals } = await supabase
            .from("signals")
            .select(
              "id, title, snippet, sender_name, sender_email, received_at, urgency_score"
            )
            .eq("user_id", userId)
            .eq("source", "gmail")
            .eq("thread_id", signal.thread_id)
            .order("received_at", { ascending: false })
            .limit(5);

          relatedSignals = threadSignals ?? [];
        }

        const summary =
          relatedSignals.length > 1
            ? `I reviewed "${signal.title}" and found ${relatedSignals.length} recent emails in the same thread.`
            : `I reviewed "${signal.title}" and this looks like a single-message thread.`;

        // Truncate body to limit tokens fed back into Sonnet context
        const MAX_TOOL_BODY_CHARS = 1500;
        const truncatedBody = body
          ? body.length > MAX_TOOL_BODY_CHARS
            ? body.slice(0, MAX_TOOL_BODY_CHARS) + "\n[... truncated]"
            : body
          : null;

        // Truncate related signal snippets
        const trimmedRelated = relatedSignals.map((s: Record<string, unknown>) => ({
          ...s,
          snippet: typeof s.snippet === "string" ? s.snippet.slice(0, 200) : s.snippet,
        }));

        return {
          signal: {
            id: signal.id,
            title: signal.title,
            sender_name: signal.sender_name,
            sender_email: signal.sender_email,
            urgency_score: signal.urgency_score,
            received_at: signal.received_at,
            snippet: signal.snippet,
            body: truncatedBody,
          },
          relatedSignals: trimmedRelated,
          message: summary,
        };
      },
    },

    generate_meeting_brief: {
      description:
        "Generate a prep brief for a specific meeting, including related signals and suggested talking points.",
      inputSchema: zodSchema(
        z.object({
          meeting_title: z
            .string()
            .describe("Title of the meeting to generate a brief for"),
        })
      ),
      execute: async ({ meeting_title }: { meeting_title: string }) => {
        const supabase = await createServiceRoleClient();

        const { data: meetings } = await supabase
          .from("calendar_events")
          .select("*")
          .eq("user_id", userId)
          .ilike("title", `%${sanitizeFilterValue(meeting_title)}%`)
          .order("start_at")
          .limit(1);

        if (!meetings?.length) {
          return { error: `No meeting found matching "${meeting_title}"` };
        }

        const meeting = meetings[0];

        const { data: signals } = await supabase
          .from("signals")
          .select(
            "title, snippet, sender_name, sender_email, topic_cluster, urgency_score, received_at"
          )
          .eq("user_id", userId)
          .order("received_at", { ascending: false })
          .limit(10);

        return {
          meeting: {
            title: meeting.title,
            start: meeting.start_at,
            end: meeting.end_at,
            attendees: meeting.attendee_count,
            density: meeting.decision_density,
            role: meeting.ownership_load,
            risks: meeting.efficiency_risks,
            description: meeting.description?.slice(0, 500),
          },
          relatedSignals:
            signals?.map((s: Record<string, unknown>) => ({
              title: s.title,
              from: s.sender_name,
              topic: s.topic_cluster,
              snippet:
                typeof s.snippet === "string"
                  ? s.snippet.slice(0, 200)
                  : null,
            })) ?? [],
        };
      },
    },

    draft_email: {
      description:
        "Draft an email reply. Returns the draft for the user to review — does NOT send it.",
      inputSchema: zodSchema(
        z.object({
          to: z.string().describe("Recipient email"),
          subject: z.string().describe("Email subject"),
          body: z.string().describe("Email body content"),
          in_reply_to: z
            .string()
            .nullable()
            .describe("Signal ID this is replying to, if applicable"),
        })
      ),
      execute: async ({
        to,
        subject,
        body,
        in_reply_to,
      }: {
        to: string;
        subject: string;
        body: string;
        in_reply_to: string | null;
      }) => {
        const supabase = await createServiceRoleClient();
        const { data: draft, error } = await supabase
          .from("draft_replies")
          .insert({
            user_id: userId,
            signal_id: in_reply_to,
            to_email: to,
            subject,
            body,
            tone: "professional",
            draft_type: "reply",
            status: "pending",
            model_used: "chat_tool",
          })
          .select("id")
          .single();

        if (error || !draft) {
          return {
            error: error?.message ?? "Failed to save email draft for review.",
          };
        }

        return {
          status: "draft_saved" as const,
          draft_id: draft.id,
          to,
          subject,
          body,
          in_reply_to,
          drafts_path: "/drafts",
          body_preview: body.slice(0, 280),
          message:
            "Email draft saved to Drafts. Review and approve it there before sending.",
        };
      },
    },

    send_email: {
      description:
        "Send an email that was previously drafted. Only call this after the user has explicitly confirmed the draft.",
      inputSchema: zodSchema(
        z.object({
          to: z.string().describe("Recipient email"),
          subject: z.string().describe("Email subject"),
          body: z.string().describe("Email body content"),
          in_reply_to: z
            .string()
            .nullable()
            .optional()
            .describe("Message-ID header to reply to, if applicable"),
        })
      ),
      execute: async ({
        to,
        subject,
        body,
        in_reply_to,
      }: {
        to: string;
        subject: string;
        body: string;
        in_reply_to?: string | null;
      }) => {
        const connectionId = await getGoogleConnectionId(userId);
        if (!connectionId) {
          return { error: "No Google account connected. Connect Google in Settings first." };
        }
        try {
          const result = await sendEmail(connectionId, {
            to,
            subject,
            body,
            inReplyTo: in_reply_to,
          });
          return { status: "sent", messageId: result.messageId, threadId: result.threadId };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to send email" };
        }
      },
    },

    draft_slack_message: {
      description:
        "Draft a Slack message. Returns the draft for review — does NOT send it.",
      inputSchema: zodSchema(
        z.object({
          channel: z.string().describe("Channel name or ID"),
          message: z.string().describe("Message content"),
          thread_ts: z
            .string()
            .nullable()
            .describe("Thread timestamp to reply to, if applicable"),
        })
      ),
      execute: async ({
        channel,
        message,
        thread_ts,
      }: {
        channel: string;
        message: string;
        thread_ts: string | null;
      }) => {
        const supabase = await createServiceRoleClient();
        const { data: draft, error } = await supabase
          .from("slack_drafts")
          .insert({
            user_id: userId,
            channel_id: channel,
            channel_label: channel,
            message,
            thread_ts,
            status: "pending",
            model_used: "chat_tool",
          })
          .select("id")
          .single();

        if (error || !draft) {
          return {
            error: error?.message ?? "Failed to save Slack draft for review.",
          };
        }

        return {
          status: "draft_saved" as const,
          draft_id: draft.id,
          channel,
          message,
          thread_ts,
          note: "Slack draft saved to Drafts. Review and approve it there before sending.",
        };
      },
    },

    send_slack_message: {
      description:
        "Send a Slack message that was previously drafted. Only call this after the user has explicitly confirmed the draft.",
      inputSchema: zodSchema(
        z.object({
          channel: z.string().describe("Channel name or ID"),
          message: z.string().describe("Message content"),
          thread_ts: z
            .string()
            .nullable()
            .optional()
            .describe("Thread timestamp to reply to, if applicable"),
        })
      ),
      execute: async ({
        channel,
        message,
        thread_ts,
      }: {
        channel: string;
        message: string;
        thread_ts?: string | null;
      }) => {
        const connectionId = await getSlackConnectionId(userId);
        if (!connectionId) {
          return { error: "No Slack workspace connected. Connect Slack in Settings first." };
        }
        try {
          const result = await sendSlackMessage(connectionId, {
            channel,
            text: message,
            threadTs: thread_ts,
          });
          return { status: "sent", ts: result.ts, channel: result.channel };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to send Slack message" };
        }
      },
    },

    find_available_times: {
      description:
        "Find available time slots in the user's calendar for scheduling meetings. Uses work hours, existing events, and preferences to suggest open slots.",
      inputSchema: zodSchema(
        z.object({
          duration_minutes: z
            .number()
            .int()
            .min(15)
            .max(480)
            .describe("Meeting duration in minutes"),
          earliest: z
            .string()
            .describe("Earliest date to consider (YYYY-MM-DD)"),
          latest: z
            .string()
            .describe("Latest date to consider (YYYY-MM-DD)"),
          preferred_time: z
            .enum(["morning", "afternoon", "any"])
            .default("any")
            .describe("Time of day preference"),
        })
      ),
      execute: async ({
        duration_minutes,
        earliest,
        latest,
        preferred_time,
      }: {
        duration_minutes: number;
        earliest: string;
        latest: string;
        preferred_time: "morning" | "afternoon" | "any";
      }) => {
        try {
          const result = await findAvailableTimes(userId, {
            durationMinutes: duration_minutes,
            earliest,
            latest,
            preferredTime: preferred_time,
          });
          return {
            slots: result.slots,
            timezone: result.timezone,
            count: result.slots.length,
          };
        } catch (err) {
          return {
            error: err instanceof Error ? err.message : "Failed to find available times",
          };
        }
      },
    },
  };
}

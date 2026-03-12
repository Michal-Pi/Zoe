import { z } from "zod";
import { zodSchema } from "ai";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/integrations/gmail";
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
        return { signals: data ?? [], count: data?.length ?? 0 };
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
        return {
          status: "draft" as const,
          to,
          subject,
          body,
          in_reply_to,
          message:
            "Draft ready. Present to user for review. If approved, use send_email.",
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

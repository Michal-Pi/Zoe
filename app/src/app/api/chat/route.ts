import { stepCountIs, streamText } from "ai";
import { models } from "@/lib/ai/providers";
import { getChatTools } from "@/lib/ai/tools/chat-tools";
import {
  createServiceRoleClient,
  createServerSupabaseClient,
} from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const { messages, conversationId } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("Messages must be a non-empty array", { status: 400 });
  }

  // Get authenticated user
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const serviceClient = await createServiceRoleClient();

  // Ensure conversation exists and belongs to the authenticated user
  let convId = conversationId;
  if (convId) {
    const { data: existingConv } = await serviceClient
      .from("chat_conversations")
      .select("id")
      .eq("id", convId)
      .eq("user_id", user.id)
      .single();
    if (!existingConv) {
      return new Response("Conversation not found", { status: 404 });
    }
  }
  if (!convId) {
    const firstUserMsg = messages.find(
      (m: { role: string }) => m.role === "user"
    );
    const { data: conv } = await serviceClient
      .from("chat_conversations")
      .insert({
        user_id: user.id,
        title: firstUserMsg?.content?.slice(0, 100) ?? "New conversation",
      })
      .select("id")
      .single();
    convId = conv?.id;
  }

  // Store user message
  const lastUserMsg = messages[messages.length - 1];
  if (lastUserMsg?.role === "user" && convId) {
    await serviceClient.from("chat_messages").insert({
      conversation_id: convId,
      user_id: user.id,
      role: "user",
      content: lastUserMsg.content,
    });
  }

  // Fetch context for system prompt
  const [
    { data: priorities },
    { data: recentActivities },
  ] = await Promise.all([
    serviceClient
      .from("strategic_priorities")
      .select("title")
      .eq("user_id", user.id)
      .order("sort_order"),
    serviceClient
      .from("activities")
      .select("title, score, horizon, status")
      .eq("user_id", user.id)
      .in("status", ["pending", "in_progress"])
      .order("score", { ascending: false })
      .limit(5),
  ]);

  const priorityList =
    priorities?.map((p) => p.title).join(", ") || "None set";
  const activityList =
    recentActivities
      ?.map(
        (a) =>
          `- [${a.score}] ${a.title} (${a.horizon}, ${a.status})`
      )
      .join("\n") || "No activities yet";

  const systemPrompt = `You are Zoe, a personal assistant for a busy professional. You help them manage their work by searching signals, generating meeting briefs, drafting communications, and providing productivity insights.

Current priorities: ${priorityList}

Top activities:
${activityList}

Guidelines:
- Be concise and actionable. Busy professionals don't have time for fluff.
- When the user asks about meetings, use get_todays_meetings to get real data.
- When they ask about emails/messages, use search_signals.
- When they ask for the most important email to answer, use get_top_email_signals.
- When they ask to draft a reply to the most important email, first call get_top_email_signals with limit 1, then immediately call draft_email using that email and tell the user which email you chose.
- When they ask to draft a reply, use draft_email or draft_slack_message.
- When they need meeting prep, use generate_meeting_brief.
- Always reference specific data — don't make up meetings or signals.
- For drafts, present them clearly so the user can review and approve.
- Always present email and Slack message drafts for review before sending. Only call send_email or send_slack_message after the user explicitly approves the draft.
- If you don't have enough context, ask a clarifying question rather than guessing.`;

  const tools = getChatTools(user.id);

  const result = streamText({
    model: models.standard,
    system: systemPrompt,
    messages,
    tools,
    stopWhen: stepCountIs(5),
  });

  // Store assistant response after streaming completes
  Promise.resolve(result.text)
    .then(async (text: string) => {
      if (convId && text) {
        const { error: storeErr } = await serviceClient.from("chat_messages").insert({
          conversation_id: convId,
          user_id: user.id,
          role: "assistant",
          content: text,
        });
        if (storeErr) console.error("Failed to store assistant message:", storeErr);
      }
    })
    .catch((err: unknown) => {
      console.error("Failed to read streaming result:", err);
    });

  return result.toUIMessageStreamResponse();
}

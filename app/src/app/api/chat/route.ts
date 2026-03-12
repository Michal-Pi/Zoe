import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
} from "ai";
import { models } from "@/lib/ai/providers";
import { getChatTools } from "@/lib/ai/tools/chat-tools";
import {
  createServiceRoleClient,
  createServerSupabaseClient,
} from "@/lib/supabase/server";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let body;
  try {
    body = await request.json();
  } catch {
    console.error(`[chat:${requestId}] invalid json body`);
    return new Response("Invalid JSON", { status: 400 });
  }
  const { messages, conversationId } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    console.error(`[chat:${requestId}] invalid messages payload`);
    return new Response("Messages must be a non-empty array", { status: 400 });
  }

  const lastUserMsg = messages[messages.length - 1];
  console.log(
    `[chat:${requestId}] request received`,
    JSON.stringify({
      conversationId: conversationId ?? null,
      messageCount: messages.length,
      lastRole: lastUserMsg?.role ?? null,
      lastUserPreview:
        typeof lastUserMsg?.content === "string"
          ? lastUserMsg.content.slice(0, 160)
          : null,
    })
  );

  // Get authenticated user
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error(`[chat:${requestId}] unauthorized`);
    return new Response("Unauthorized", { status: 401 });
  }

  console.log(`[chat:${requestId}] authenticated user`, user.id);

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
      console.error(`[chat:${requestId}] conversation not found`, convId);
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
    console.log(`[chat:${requestId}] created conversation`, convId);
  }

  // Store user message
  if (lastUserMsg?.role === "user" && convId) {
    const { error: insertUserError } = await serviceClient.from("chat_messages").insert({
      conversation_id: convId,
      user_id: user.id,
      role: "user",
      content: lastUserMsg.content,
    });
    if (insertUserError) {
      console.error(`[chat:${requestId}] failed to store user message`, insertUserError);
    }
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
- When they ask to draft a reply to the most important email, first call get_top_email_signals with limit 1, then call get_email_thread_context for the chosen signal, then call draft_email using that context and tell the user which email you chose.
- When they ask to draft a reply, use draft_email or draft_slack_message.
- When they need meeting prep, use generate_meeting_brief.
- Always reference specific data — don't make up meetings or signals.
- For drafts, present them clearly so the user can review and approve.
- Always present email and Slack message drafts for review before sending. Only call send_email or send_slack_message after the user explicitly approves the draft.
- If you don't have enough context, ask a clarifying question rather than guessing.`;

  const tools = getChatTools(user.id);
  const tracedTools = Object.fromEntries(
    Object.entries(tools).map(([toolName, tool]) => {
      if (!tool.execute) return [toolName, tool];

      return [
        toolName,
        {
          ...tool,
          execute: async (input: unknown) => {
            console.log(
              `[chat:${requestId}] tool start`,
              JSON.stringify({
                toolName,
                input: summarizeForLog(input),
              })
            );

            try {
              const output = await tool.execute(input as never);
              console.log(
                `[chat:${requestId}] tool success`,
                JSON.stringify({
                  toolName,
                  output: summarizeForLog(output),
                })
              );
              return output;
            } catch (error) {
              console.error(
                `[chat:${requestId}] tool failure`,
                JSON.stringify({
                  toolName,
                  error: error instanceof Error ? error.message : String(error),
                })
              );
              throw error;
            }
          },
        },
      ];
    })
  );

  console.log(
    `[chat:${requestId}] starting stream`,
    JSON.stringify({
      model: "claude-sonnet-4-6",
      conversationId: convId,
      toolCount: Object.keys(tracedTools).length,
    })
  );

  let finalAssistantText = "";
  let fallbackAssistantText = "";

  const result = streamText({
    model: models.standard,
    system: systemPrompt,
    messages,
    tools: tracedTools,
    stopWhen: stepCountIs(5),
    experimental_onStepStart: ({ stepNumber }) => {
      console.log(`[chat:${requestId}] step start`, stepNumber);
    },
    experimental_onToolCallStart: ({ toolCall }) => {
      console.log(
        `[chat:${requestId}] tool callback start`,
        JSON.stringify({
          toolName: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        })
      );
    },
    experimental_onToolCallFinish: ({ toolCall, success, output, error, durationMs }) => {
      console.log(
        `[chat:${requestId}] tool callback finish`,
        JSON.stringify({
          toolName: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          success,
          durationMs,
          result: summarizeForLog(success ? output : error),
        })
      );
    },
    onStepFinish: ({ stepNumber, finishReason, text, toolResults }) => {
      if (!fallbackAssistantText) {
        fallbackAssistantText = buildFallbackAssistantText(toolResults);
      }
      console.log(
        `[chat:${requestId}] step finish`,
        JSON.stringify({
          stepNumber,
          finishReason,
          textPreview: text?.slice(0, 160) ?? null,
          toolResults: toolResults?.map((toolResult) => ({
            toolName: toolResult.toolName,
            output: summarizeForLog(toolResult.output),
          })),
        })
      );
    },
    onFinish: ({ text, finishReason, steps }) => {
      finalAssistantText = text ?? "";
      if (!finalAssistantText) {
        for (const step of [...steps].reverse()) {
          const candidate = buildFallbackAssistantText(step.toolResults);
          if (candidate) {
            fallbackAssistantText = candidate;
            break;
          }
        }
      }
      console.log(
        `[chat:${requestId}] stream finish`,
        JSON.stringify({
          finishReason,
          textPreview: text?.slice(0, 200) ?? null,
          fallbackPreview: fallbackAssistantText.slice(0, 200) || null,
          steps: steps.length,
        })
      );
    },
    onError: ({ error }) => {
      console.error(
        `[chat:${requestId}] stream error`,
        error instanceof Error ? error.stack ?? error.message : String(error)
      );
    },
  });

  const uiStream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.merge(
        result.toUIMessageStream({
          onError: (error) => {
            console.error(
              `[chat:${requestId}] merged ui stream error`,
              error instanceof Error ? error.stack ?? error.message : String(error)
            );
            return "Chat stream failed";
          },
        })
      );

      await result.consumeStream({
        onError: (error) => {
          console.error(
            `[chat:${requestId}] consume stream error`,
            error instanceof Error ? error.stack ?? error.message : String(error)
          );
        },
      });

      if (!finalAssistantText && fallbackAssistantText) {
        const textId = `fallback-${requestId}`;
        writer.write({ type: "text-start", id: textId });
        writer.write({
          type: "text-delta",
          id: textId,
          delta: fallbackAssistantText,
        });
        writer.write({ type: "text-end", id: textId });
        finalAssistantText = fallbackAssistantText;
        console.log(
          `[chat:${requestId}] emitted fallback assistant text`,
          JSON.stringify({ textPreview: fallbackAssistantText.slice(0, 200) })
        );
      }
      const textToStore = finalAssistantText || fallbackAssistantText;
      console.log(
        `[chat:${requestId}] result text resolved`,
        JSON.stringify({ textPreview: textToStore?.slice(0, 200) ?? null })
      );
      if (convId && textToStore) {
        const { error: storeErr } = await serviceClient.from("chat_messages").insert({
          conversation_id: convId,
          user_id: user.id,
          role: "assistant",
          content: textToStore,
        });
        if (storeErr) {
          console.error(`[chat:${requestId}] failed to store assistant message`, storeErr);
        } else {
          console.log(`[chat:${requestId}] assistant message stored`);
        }
      }
    },
    onError: (error) => {
      console.error(
        `[chat:${requestId}] ui stream wrapper error`,
        error instanceof Error ? error.stack ?? error.message : String(error)
      );
      return "Chat stream failed";
    },
  });

  return createUIMessageStreamResponse({ stream: uiStream });
}

function summarizeForLog(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    return value.length > 200 ? `${value.slice(0, 200)}...` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 3).map((item) => summarizeForLog(item));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 8);
    return Object.fromEntries(
      entries.map(([key, entryValue]) => [key, summarizeForLog(entryValue)])
    );
  }
  return value;
}

function buildFallbackAssistantText(
  toolResults:
    | Array<{
        toolName: string;
        output: unknown;
      }>
    | undefined
) {
  if (!toolResults?.length) return "";

  const lastTool = [...toolResults].reverse().find(Boolean);
  if (!lastTool) return "";

  const output =
    lastTool.output && typeof lastTool.output === "object"
      ? (lastTool.output as Record<string, unknown>)
      : null;

  if (lastTool.toolName === "draft_email" && output?.status === "draft_saved") {
    const subject =
      typeof output.subject === "string" ? output.subject : "your draft";
    return `I saved a draft reply for "${subject}" in Drafts. Review it before sending.`;
  }

  if (
    lastTool.toolName === "draft_slack_message" &&
    output?.status === "draft_saved"
  ) {
    return "I saved a Slack draft in Drafts. Review it before sending.";
  }

  if (typeof output?.message === "string") return output.message;
  if (typeof output?.note === "string") return output.note;
  if (typeof output?.error === "string") return output.error;

  return "";
}

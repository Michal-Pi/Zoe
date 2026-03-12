import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendSlackMessage } from "@/lib/integrations/slack";
import { z } from "zod";

const sendSlackDraftSchema = z.object({
  draftId: z.string().uuid(),
  channel: z.string().min(1),
  message: z.string().min(1),
  threadTs: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await request.json();
  const parsed = sendSlackDraftSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { draftId, channel, message, threadTs } = parsed.data;

  const { data: draft, error: draftError } = await supabase
    .from("slack_drafts")
    .select("id, status, accepted_at")
    .eq("id", draftId)
    .eq("user_id", user.id)
    .single();

  if (draftError || !draft) {
    return NextResponse.json({ error: "Slack draft not found" }, { status: 404 });
  }

  if (draft.status === "sent") {
    return NextResponse.json({ error: "Slack draft already sent" }, { status: 400 });
  }

  if (draft.status !== "accepted" || !draft.accepted_at) {
    return NextResponse.json(
      { error: "Slack draft must be approved before sending" },
      { status: 400 }
    );
  }

  const { data: connection } = await supabase
    .from("integration_connections")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", "slack")
    .eq("status", "active")
    .limit(1)
    .single();

  if (!connection) {
    return NextResponse.json(
      { error: "No Slack workspace connected" },
      { status: 400 }
    );
  }

  try {
    const result = await sendSlackMessage(connection.id, {
      channel,
      text: message,
      threadTs,
    });

    await supabase
      .from("slack_drafts")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", draftId);

    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send Slack message" },
      { status: 500 }
    );
  }
}

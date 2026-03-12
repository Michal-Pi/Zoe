import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/integrations/gmail";
import { z } from "zod";

const sendDraftSchema = z.object({
  draftId: z.string().uuid(),
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
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
  const parsed = sendDraftSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { draftId, to, subject, body } = parsed.data;

  // Verify the draft belongs to this user and is sendable
  const { data: draft, error: draftError } = await supabase
    .from("draft_replies")
    .select("id, status, accepted_at")
    .eq("id", draftId)
    .eq("user_id", user.id)
    .single();

  if (draftError || !draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  if (draft.status === "sent") {
    return NextResponse.json(
      { error: "Draft already sent" },
      { status: 400 }
    );
  }

  if (draft.status !== "accepted" || !draft.accepted_at) {
    return NextResponse.json(
      { error: "Draft must be approved before sending" },
      { status: 400 }
    );
  }

  // Get user's Google connection
  const { data: connection } = await supabase
    .from("integration_connections")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .eq("status", "active")
    .limit(1)
    .single();

  if (!connection) {
    return NextResponse.json(
      { error: "No Google account connected" },
      { status: 400 }
    );
  }

  try {
    const result = await sendEmail(connection.id, { to, subject, body });

    // Mark draft as sent
    await supabase
      .from("draft_replies")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_message_id: result.messageId,
        sent_thread_id: result.threadId,
      })
      .eq("id", draftId);

    return NextResponse.json({
      data: { messageId: result.messageId, threadId: result.threadId },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send email" },
      { status: 500 }
    );
  }
}

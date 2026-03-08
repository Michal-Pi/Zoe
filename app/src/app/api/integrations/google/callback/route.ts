import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/integrations/google-auth";
import { syncCalendarEvents } from "@/lib/integrations/google-calendar";
import { syncGmailMessages } from "@/lib/integrations/gmail";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${origin}/settings?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/settings?error=missing_params`);
  }

  // Verify the user from state
  let stateData: { userId: string };
  try {
    stateData = JSON.parse(
      Buffer.from(state, "base64url").toString("utf-8")
    );
  } catch {
    return NextResponse.redirect(`${origin}/settings?error=invalid_state`);
  }

  // Verify the logged-in user matches the state
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== stateData.userId) {
    return NextResponse.redirect(`${origin}/settings?error=user_mismatch`);
  }

  try {
    const { connectionId, email } = await exchangeCodeForTokens(
      code,
      user.id
    );

    // Trigger initial syncs (background, don't block redirect)
    syncCalendarEvents(user.id, connectionId).catch((err) => {
      console.error("Initial calendar sync failed:", err);
    });
    syncGmailMessages(user.id, connectionId).catch((err) => {
      console.error("Initial Gmail sync failed:", err);
    });

    return NextResponse.redirect(
      `${origin}/settings?success=google&email=${encodeURIComponent(email)}`
    );
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(`${origin}/settings?error=token_exchange`);
  }
}

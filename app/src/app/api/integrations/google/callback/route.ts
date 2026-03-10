import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/integrations/google-auth";
import { syncCalendarEvents } from "@/lib/integrations/google-calendar";
import { syncGmailMessages } from "@/lib/integrations/gmail";
import { getAbsoluteAppUrl } from "@/lib/base-path";

function sanitizeReturnTo(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/settings";
  }

  return value;
}

function buildReturnPath(
  returnTo: string,
  params: Record<string, string>
): string {
  const url = new URL(returnTo, "http://localhost");

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return `${url.pathname}${url.search}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const defaultReturnTo = sanitizeReturnTo(
    request.nextUrl.searchParams.get("next") ?? undefined
  );

  if (error) {
    return NextResponse.redirect(
      getAbsoluteAppUrl(
        origin,
        buildReturnPath(defaultReturnTo, { error })
      )
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      getAbsoluteAppUrl(
        origin,
        buildReturnPath(defaultReturnTo, { error: "missing_params" })
      )
    );
  }

  // Verify the user from state
  let stateData: { userId: string; returnTo?: string };
  try {
    stateData = JSON.parse(
      Buffer.from(state, "base64url").toString("utf-8")
    );
  } catch {
    return NextResponse.redirect(
      getAbsoluteAppUrl(
        origin,
        buildReturnPath(defaultReturnTo, { error: "invalid_state" })
      )
    );
  }

  const returnTo = sanitizeReturnTo(stateData.returnTo);

  // Verify the logged-in user matches the state
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== stateData.userId) {
    return NextResponse.redirect(
      getAbsoluteAppUrl(
        origin,
        buildReturnPath(returnTo, { error: "user_mismatch" })
      )
    );
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
      getAbsoluteAppUrl(
        origin,
        buildReturnPath(returnTo, {
          success: "google",
          email,
        })
      )
    );
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(
      getAbsoluteAppUrl(
        origin,
        buildReturnPath(returnTo, { error: "token_exchange" })
      )
    );
  }
}

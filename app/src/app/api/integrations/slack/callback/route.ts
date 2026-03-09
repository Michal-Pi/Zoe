import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { exchangeSlackCode } from "@/lib/integrations/slack";
import { getAbsoluteAppUrl } from "@/lib/base-path";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      getAbsoluteAppUrl(
        origin,
        `/settings?error=${encodeURIComponent(error)}`
      )
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      getAbsoluteAppUrl(origin, "/settings?error=missing_params")
    );
  }

  let stateData: { userId: string };
  try {
    stateData = JSON.parse(
      Buffer.from(state, "base64url").toString("utf-8")
    );
  } catch {
    return NextResponse.redirect(
      getAbsoluteAppUrl(origin, "/settings?error=invalid_state")
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== stateData.userId) {
    return NextResponse.redirect(
      getAbsoluteAppUrl(origin, "/settings?error=user_mismatch")
    );
  }

  try {
    const { teamName } = await exchangeSlackCode(code, user.id);
    return NextResponse.redirect(
      getAbsoluteAppUrl(
        origin,
        `/settings?success=slack&email=${encodeURIComponent(teamName)}`
      )
    );
  } catch (err) {
    console.error("Slack OAuth callback error:", err);
    return NextResponse.redirect(
      getAbsoluteAppUrl(origin, "/settings?error=slack_auth")
    );
  }
}

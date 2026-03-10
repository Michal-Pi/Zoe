import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthUrl } from "@/lib/integrations/google-auth";
import crypto from "crypto";

function sanitizeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/settings";
  }

  return value;
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Generate a state token to prevent CSRF
  const state = JSON.stringify({
    userId: user.id,
    nonce: crypto.randomBytes(16).toString("hex"),
    returnTo: sanitizeReturnTo(request.nextUrl.searchParams.get("next")),
  });

  const encodedState = Buffer.from(state).toString("base64url");
  const authUrl = getAuthUrl(encodedState);

  return NextResponse.redirect(authUrl);
}

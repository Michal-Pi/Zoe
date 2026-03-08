import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthUrl } from "@/lib/integrations/google-auth";
import crypto from "crypto";

export async function GET() {
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
  });

  const encodedState = Buffer.from(state).toString("base64url");
  const authUrl = getAuthUrl(encodedState);

  return NextResponse.redirect(authUrl);
}

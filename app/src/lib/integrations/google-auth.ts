import { google } from "googleapis";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getAbsoluteAppUrl } from "@/lib/base-path";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "openid",
];

function getOAuthClient() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getAbsoluteAppUrl(appUrl, "/api/integrations/google/callback")
  );
}

/** Generate the Google OAuth URL for the user to authorize */
export function getAuthUrl(state: string): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    state,
  });
}

/** Exchange auth code for tokens and store in Supabase */
export async function exchangeCodeForTokens(
  code: string,
  userId: string
): Promise<{ connectionId: string; email: string }> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);

  // Get user info to identify the account
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data: userInfo } = await oauth2.userinfo.get();
  const email = userInfo.email;
  if (!email) throw new Error("Google account has no email address");

  const supabase = await createServiceRoleClient();

  // Upsert integration connection
  const { data: connection, error: connError } = await supabase
    .from("integration_connections")
    .upsert(
      {
        user_id: userId,
        provider: "google",
        provider_account_id: email,
        email,
        scopes: SCOPES,
        status: "active",
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider,provider_account_id" }
    )
    .select("id")
    .single();

  if (connError) throw connError;

  // Store tokens (server-only table)
  await supabase.from("integration_tokens").upsert(
    {
      connection_id: connection.id,
      access_token: tokens.access_token ?? "",
      refresh_token: tokens.refresh_token ?? null,
      token_type: tokens.token_type ?? "Bearer",
      expires_at: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : null,
    },
    { onConflict: "connection_id" }
  );

  return { connectionId: connection.id, email };
}

/** Get a valid access token, refreshing if needed (5-min buffer) */
export async function getValidAccessToken(
  connectionId: string
): Promise<string> {
  const supabase = await createServiceRoleClient();

  const { data: tokenRow, error } = await supabase
    .from("integration_tokens")
    .select("*")
    .eq("connection_id", connectionId)
    .single();

  if (error || !tokenRow) {
    throw new Error(`No tokens found for connection ${connectionId}`);
  }

  // Check if expired (5-minute buffer)
  const expiresAt = tokenRow.expires_at
    ? new Date(tokenRow.expires_at).getTime()
    : 0;
  const isExpired = expiresAt < Date.now() + 5 * 60 * 1000;

  if (!isExpired && tokenRow.access_token) {
    return tokenRow.access_token;
  }

  // Refresh the token
  if (!tokenRow.refresh_token) {
    throw new Error("No refresh token available. User must re-authorize.");
  }

  const client = getOAuthClient();
  client.setCredentials({ refresh_token: tokenRow.refresh_token });

  const { credentials } = await client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error("Token refresh did not return an access token");
  }

  // Update stored tokens
  const { error: updateErr } = await supabase
    .from("integration_tokens")
    .update({
      access_token: credentials.access_token,
      expires_at: credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq("connection_id", connectionId);

  if (updateErr) console.error("Failed to store refreshed token:", updateErr);

  return credentials.access_token;
}

/** Disconnect Google account */
export async function disconnectGoogle(
  userId: string,
  connectionId: string
): Promise<void> {
  const supabase = await createServiceRoleClient();

  // Try to revoke the token
  try {
    const { data: tokenRow } = await supabase
      .from("integration_tokens")
      .select("access_token")
      .eq("connection_id", connectionId)
      .single();

    if (tokenRow?.access_token) {
      const client = getOAuthClient();
      await client.revokeToken(tokenRow.access_token);
    }
  } catch {
    // Revocation failure is not critical
  }

  // Delete tokens and mark connection as revoked
  await supabase
    .from("integration_tokens")
    .delete()
    .eq("connection_id", connectionId);

  await supabase
    .from("integration_connections")
    .update({ status: "revoked" })
    .eq("id", connectionId)
    .eq("user_id", userId);
}

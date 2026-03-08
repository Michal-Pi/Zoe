import { createServiceRoleClient } from "@/lib/supabase/server";

const SLACK_API = "https://slack.com/api";

interface SlackMessage {
  type: string;
  ts: string;
  user?: string;
  text?: string;
  thread_ts?: string;
  reply_count?: number;
  channel?: string;
}

interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_im: boolean;
  is_mpim: boolean;
  is_member: boolean;
}

/** Exchange Slack OAuth code for access token */
export async function exchangeSlackCode(
  code: string,
  userId: string
): Promise<{ connectionId: string; teamName: string }> {
  const response = await fetch(`${SLACK_API}/oauth.v2.access`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/slack/callback`,
    }),
  });

  const data = await response.json();
  if (!data.ok) throw new Error(`Slack OAuth error: ${data.error}`);

  const supabase = await createServiceRoleClient();

  // Upsert connection
  const { data: connection, error } = await supabase
    .from("integration_connections")
    .upsert(
      {
        user_id: userId,
        provider: "slack",
        provider_account_id: data.team?.id,
        email: null,
        scopes: data.scope?.split(",") ?? [],
        status: "active",
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider,provider_account_id" }
    )
    .select("id")
    .single();

  if (error) throw error;

  // Store bot token
  await supabase.from("integration_tokens").upsert(
    {
      connection_id: connection.id,
      access_token: data.access_token,
      refresh_token: null,
      token_type: "Bearer",
      expires_at: null, // Slack tokens don't expire
    },
    { onConflict: "connection_id" }
  );

  return { connectionId: connection.id, teamName: data.team?.name ?? "Slack" };
}

/** Get Slack access token for a connection */
async function getSlackToken(connectionId: string): Promise<string> {
  const supabase = await createServiceRoleClient();
  const { data, error } = await supabase
    .from("integration_tokens")
    .select("access_token")
    .eq("connection_id", connectionId)
    .single();

  if (error || !data) throw new Error("No Slack token found");
  return data.access_token;
}

/** Send a message to a Slack channel */
export async function sendSlackMessage(
  connectionId: string,
  { channel, text, threadTs }: {
    channel: string;
    text: string;
    threadTs?: string | null;
  }
): Promise<{ ts: string; channel: string }> {
  const token = await getSlackToken(connectionId);

  const body: Record<string, string> = { channel, text };
  if (threadTs) body.thread_ts = threadTs;

  const response = await fetch(`${SLACK_API}/chat.postMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Slack send error: ${data.error}`);
  }

  return { ts: data.ts, channel: data.channel };
}

/** Fetch channels the bot has access to */
export async function fetchSlackChannels(
  connectionId: string
): Promise<SlackChannel[]> {
  const token = await getSlackToken(connectionId);
  const allChannels: SlackChannel[] = [];
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({
      types: "public_channel,private_channel,im,mpim",
      limit: "200",
      exclude_archived: "true",
    });
    if (cursor) params.set("cursor", cursor);

    const response = await fetch(
      `${SLACK_API}/conversations.list?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();
    if (!data.ok) throw new Error(`Slack API error: ${data.error}`);

    allChannels.push(...(data.channels ?? []));
    cursor = data.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return allChannels;
}

/** Fetch recent messages from a Slack channel */
async function fetchChannelMessages(
  connectionId: string,
  channelId: string,
  oldest?: string
): Promise<SlackMessage[]> {
  const token = await getSlackToken(connectionId);
  const params = new URLSearchParams({
    channel: channelId,
    limit: "100",
  });
  if (oldest) params.set("oldest", oldest);

  const response = await fetch(
    `${SLACK_API}/conversations.history?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await response.json();
  if (!data.ok) {
    // Channel not accessible — skip silently
    if (data.error === "channel_not_found" || data.error === "not_in_channel") {
      return [];
    }
    throw new Error(`Slack API error: ${data.error}`);
  }

  return data.messages ?? [];
}

/** Get user info for display name */
async function getUserInfo(
  connectionId: string,
  slackUserId: string
): Promise<{ name: string; email: string | null }> {
  const token = await getSlackToken(connectionId);
  const response = await fetch(
    `${SLACK_API}/users.info?user=${slackUserId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await response.json();
  if (!data.ok) return { name: slackUserId, email: null };
  return {
    name: data.user?.real_name ?? data.user?.name ?? slackUserId,
    email: data.user?.profile?.email ?? null,
  };
}

/** Normalize a Slack message to our signals schema */
function normalizeSlackMessage(
  msg: SlackMessage,
  channelId: string,
  channelName: string,
  userId: string,
  senderName: string,
  senderEmail: string | null
): Record<string, unknown> {
  const isThread = Boolean(msg.thread_ts && msg.thread_ts !== msg.ts);
  const receivedAt = new Date(parseFloat(msg.ts) * 1000).toISOString();

  return {
    user_id: userId,
    source: "slack",
    source_type: isThread ? "slack_thread" : "slack_message",
    external_id: `${channelId}:${msg.ts}`,
    thread_id: msg.thread_ts ? `slack:${channelId}:${msg.thread_ts}` : null,
    title: `#${channelName}`,
    snippet: msg.text?.slice(0, 200) ?? null,
    sender_name: senderName,
    sender_email: senderEmail,
    participants: null, // populated later if needed
    received_at: receivedAt,
    is_read: false,
    is_starred: false,
    labels: [channelName],
    ingested_at: new Date().toISOString(),
  };
}

/** Sync messages from monitored Slack channels to signals table */
export async function syncSlackMessages(
  userId: string,
  connectionId: string,
  options: { daysBack?: number } = {}
): Promise<{ synced: number }> {
  const supabase = await createServiceRoleClient();
  const daysBack = options.daysBack ?? 7;

  // Get monitored channels
  const { data: channelConfigs } = await supabase
    .from("slack_channel_configs")
    .select("channel_id, channel_name")
    .eq("user_id", userId)
    .eq("connection_id", connectionId)
    .eq("is_monitored", true);

  if (!channelConfigs?.length) return { synced: 0 };

  const oldest = String(
    (Date.now() - daysBack * 24 * 60 * 60 * 1000) / 1000
  );
  let totalSynced = 0;

  // User info cache
  const userCache = new Map<string, { name: string; email: string | null }>();

  for (const config of channelConfigs) {
    const messages = await fetchChannelMessages(
      connectionId,
      config.channel_id,
      oldest
    );

    const normalized = [];
    for (const msg of messages) {
      if (!msg.user || msg.type !== "message") continue;

      // Resolve sender
      if (!userCache.has(msg.user)) {
        userCache.set(msg.user, await getUserInfo(connectionId, msg.user));
      }
      const sender = userCache.get(msg.user)!;

      normalized.push(
        normalizeSlackMessage(
          msg,
          config.channel_id,
          config.channel_name,
          userId,
          sender.name,
          sender.email
        )
      );
    }

    if (normalized.length > 0) {
      const { error } = await supabase
        .from("signals")
        .upsert(normalized, { onConflict: "user_id,source,external_id" });

      if (error) {
        console.error(`Slack upsert error for #${config.channel_name}:`, error);
      } else {
        totalSynced += normalized.length;
      }
    }
  }

  return { synced: totalSynced };
}

/** Handle incoming Slack event (from Events API webhook) */
export async function handleSlackEvent(event: {
  type: string;
  channel?: string;
  user?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  event_ts?: string;
}): Promise<void> {
  if (event.type !== "message" || !event.channel || !event.ts) return;

  const supabase = await createServiceRoleClient();

  // Find the connection for this channel
  const { data: configs } = await supabase
    .from("slack_channel_configs")
    .select("user_id, connection_id, channel_name")
    .eq("channel_id", event.channel)
    .eq("is_monitored", true);

  if (!configs?.length) return;

  for (const config of configs) {
    let senderName = event.user ?? "Unknown";
    let senderEmail: string | null = null;

    if (event.user) {
      try {
        const info = await getUserInfo(config.connection_id, event.user);
        senderName = info.name;
        senderEmail = info.email;
      } catch {
        // Use raw user ID as fallback
      }
    }

    const normalized = normalizeSlackMessage(
      {
        type: "message",
        ts: event.ts,
        user: event.user,
        text: event.text,
        thread_ts: event.thread_ts,
        channel: event.channel,
      },
      event.channel,
      config.channel_name,
      config.user_id,
      senderName,
      senderEmail
    );

    await supabase
      .from("signals")
      .upsert(normalized, { onConflict: "user_id,source,external_id" });
  }
}

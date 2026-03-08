import { getValidAccessToken } from "./google-auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

interface GmailMessagePart {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailMessagePart[];
  headers?: Array<{ name: string; value: string }>;
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart & {
    headers?: Array<{ name: string; value: string }>;
    mimeType?: string;
  };
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

function getHeader(
  headers: Array<{ name: string; value: string }> | undefined,
  name: string
): string | null {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;
}

/** Fetch message list from Gmail */
async function listMessages(
  connectionId: string,
  options: {
    query?: string;
    maxResults?: number;
    pageToken?: string;
  } = {}
): Promise<GmailListResponse> {
  const accessToken = await getValidAccessToken(connectionId);
  const params = new URLSearchParams({
    maxResults: String(options.maxResults ?? 50),
  });
  if (options.query) params.set("q", options.query);
  if (options.pageToken) params.set("pageToken", options.pageToken);

  const response = await fetch(
    `${GMAIL_API}/users/me/messages?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Gmail API error: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

/** Fetch a single message with metadata */
async function getMessage(
  connectionId: string,
  messageId: string
): Promise<GmailMessage> {
  const accessToken = await getValidAccessToken(connectionId);
  const params = new URLSearchParams({
    format: "metadata",
    metadataHeaders: "From,To,Subject,Date",
  });

  const response = await fetch(
    `${GMAIL_API}/users/me/messages/${messageId}?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Gmail API error: ${response.status}`);
  }

  return response.json();
}

/** Fetch a single message with full body content */
async function getMessageFull(
  connectionId: string,
  messageId: string
): Promise<GmailMessage> {
  const accessToken = await getValidAccessToken(connectionId);

  const response = await fetch(
    `${GMAIL_API}/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Gmail API error: ${response.status}`);
  }

  return response.json();
}

/** Recursively extract text/plain body from MIME parts */
function extractTextBody(part: GmailMessagePart): string | null {
  if (part.mimeType === "text/plain" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf-8");
  }
  if (part.parts) {
    for (const sub of part.parts) {
      const text = extractTextBody(sub);
      if (text) return text;
    }
  }
  return null;
}

/** Fetch the plain-text body of a Gmail message (up to maxLength chars) */
export async function getMessageBody(
  connectionId: string,
  messageId: string,
  maxLength: number = 3000
): Promise<string | null> {
  const msg = await getMessageFull(connectionId, messageId);
  if (!msg.payload) return null;

  const body = extractTextBody(msg.payload);
  if (!body) return null;

  return body.length > maxLength ? body.slice(0, maxLength) : body;
}

/** Parse sender into name + email */
function parseSender(from: string | null): {
  name: string | null;
  email: string | null;
} {
  if (!from) return { name: null, email: null };
  const match = from.match(/^(?:"?([^"]*?)"?\s*)?<?([^>]+@[^>]+)>?$/);
  if (match) {
    return { name: match[1]?.trim() || null, email: match[2] };
  }
  return { name: null, email: from };
}

/** Parse To header into list of email addresses */
function parseRecipients(to: string | null): string[] {
  if (!to) return [];
  return to.split(",").map((r) => {
    const match = r.match(/<([^>]+)>/);
    return match ? match[1].trim() : r.trim();
  });
}

/** Normalize a Gmail message to our signals schema */
function normalizeMessage(
  msg: GmailMessage,
  userId: string
): Record<string, unknown> {
  const headers = msg.payload?.headers;
  const from = getHeader(headers, "From");
  const to = getHeader(headers, "To");
  const subject = getHeader(headers, "Subject");
  const dateHeader = getHeader(headers, "Date");

  const sender = parseSender(from);
  const recipients = parseRecipients(to);
  const isRead = !(msg.labelIds?.includes("UNREAD") ?? true);
  const isStarred = msg.labelIds?.includes("STARRED") ?? false;

  let receivedAt: string;
  try {
    const ts = msg.internalDate ? parseInt(msg.internalDate, 10) : NaN;
    receivedAt = !isNaN(ts)
      ? new Date(ts).toISOString()
      : dateHeader
        ? new Date(dateHeader).toISOString()
        : new Date().toISOString();
  } catch {
    receivedAt = new Date().toISOString();
  }

  return {
    user_id: userId,
    source: "gmail",
    source_type: "email",
    external_id: msg.id,
    thread_id: msg.threadId,
    title: subject,
    snippet: msg.snippet ?? null,
    sender_name: sender.name,
    sender_email: sender.email,
    participants: [sender.email, ...recipients].filter(Boolean),
    received_at: receivedAt,
    is_read: isRead,
    is_starred: isStarred,
    labels: msg.labelIds ?? null,
    ingested_at: new Date().toISOString(),
  };
}

/** Strip CR/LF to prevent header injection in RFC 2822 messages */
function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]/g, " ").trim();
}

/** Send an email via the Gmail API */
export async function sendEmail(
  connectionId: string,
  { to, subject, body, inReplyTo }: {
    to: string;
    subject: string;
    body: string;
    inReplyTo?: string | null;
  }
): Promise<{ messageId: string; threadId: string }> {
  const accessToken = await getValidAccessToken(connectionId);

  // Build RFC 2822 message — sanitize header values to prevent injection
  const headers = [
    `To: ${sanitizeHeader(to)}`,
    `Subject: ${sanitizeHeader(subject)}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `MIME-Version: 1.0`,
  ];
  if (inReplyTo) {
    const safeReplyTo = sanitizeHeader(inReplyTo);
    headers.push(`In-Reply-To: ${safeReplyTo}`);
    headers.push(`References: ${safeReplyTo}`);
  }

  const rawMessage = `${headers.join("\r\n")}\r\n\r\n${body}`;
  const encodedMessage = Buffer.from(rawMessage).toString("base64url");

  const response = await fetch(
    `${GMAIL_API}/users/me/messages/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodedMessage }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gmail send error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return { messageId: data.id, threadId: data.threadId };
}

/** Sync recent Gmail messages to the signals table */
export async function syncGmailMessages(
  userId: string,
  connectionId: string,
  options: { daysBack?: number; maxMessages?: number } = {}
): Promise<{ synced: number }> {
  const daysBack = options.daysBack ?? 7;
  const maxMessages = options.maxMessages ?? 100;

  const afterDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const query = `after:${afterDate.getFullYear()}/${afterDate.getMonth() + 1}/${afterDate.getDate()} in:inbox`;

  // List message IDs
  const listResponse = await listMessages(connectionId, {
    query,
    maxResults: maxMessages,
  });

  if (!listResponse.messages?.length) {
    return { synced: 0 };
  }

  // Fetch message details in batches of 10
  const supabase = await createServiceRoleClient();
  let synced = 0;
  const batchSize = 10;

  for (let i = 0; i < listResponse.messages.length; i += batchSize) {
    const batch = listResponse.messages.slice(i, i + batchSize);
    const messages = await Promise.all(
      batch.map((m) => getMessage(connectionId, m.id))
    );

    const normalized = messages.map((msg) => normalizeMessage(msg, userId));

    const { error } = await supabase
      .from("signals")
      .upsert(normalized, { onConflict: "user_id,source,external_id" });

    if (error) {
      console.error("Gmail upsert error:", error);
    } else {
      synced += normalized.length;
    }
  }

  return { synced };
}

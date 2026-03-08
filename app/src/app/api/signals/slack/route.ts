import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { handleSlackEvent } from "@/lib/integrations/slack";

function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string
): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return false;

  // Prevent replay attacks — reject if timestamp is older than 5 minutes
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp, 10) < fiveMinutesAgo) return false;

  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature =
    "v0=" +
    createHmac("sha256", signingSecret).update(sigBasestring).digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(mySignature, "utf8"),
      Buffer.from(signature, "utf8")
    );
  } catch {
    return false;
  }
}

// Slack Events API webhook handler
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";

  const body = JSON.parse(rawBody);

  // Slack URL verification challenge (still verify signature)
  if (body.type === "url_verification") {
    if (!verifySlackSignature(rawBody, timestamp, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    return NextResponse.json({ challenge: body.challenge });
  }

  // Verify signature for all other requests
  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Ignore retries (Slack retries after 3s if no response)
  const retryNum = request.headers.get("x-slack-retry-num");
  if (retryNum) {
    return NextResponse.json({ ok: true });
  }

  // Process event
  if (body.type === "event_callback" && body.event) {
    // Don't await — respond immediately to Slack, process async
    handleSlackEvent(body.event).catch((err) => {
      console.error("Slack event processing error:", err);
    });
  }

  return NextResponse.json({ ok: true });
}

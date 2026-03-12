import { NextResponse, type NextRequest } from "next/server";

// Proactive background draft generation is intentionally disabled.
// Drafts should only be created from explicit user actions.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    message: "Proactive draft generation is disabled. Drafts are created only from explicit user actions.",
    timestamp: new Date().toISOString(),
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { findPrepSlotsForMeeting } from "@/lib/calendar/prep-blocks";

const proposalSchema = z.object({
  meetingId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await request.json();
  const parsed = proposalSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const proposal = await findPrepSlotsForMeeting(user.id, parsed.data.meetingId);
    return NextResponse.json(proposal);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to propose prep slots" },
      { status: 400 }
    );
  }
}

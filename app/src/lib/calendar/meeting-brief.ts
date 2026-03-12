import { createServiceRoleClient } from "@/lib/supabase/server";

interface MeetingBriefSignal {
  id: string;
  title: string | null;
  snippet: string | null;
  sender_name: string | null;
  sender_email: string | null;
  topic_cluster: string | null;
  urgency_score: number | null;
  received_at: string;
}

const riskLabelMap: Record<string, string> = {
  no_agenda: "No agenda is visible yet",
  back_to_back: "You are going into this back-to-back",
  recurring_stale: "Recurring context may be stale",
  too_many_attendees: "The attendee list is large",
  no_prep_time: "No prep buffer is reserved before the meeting",
};

function uniqueStrings(items: Array<string | null | undefined>): string[] {
  return Array.from(new Set(items.filter((item): item is string => Boolean(item))));
}

export async function buildMeetingBrief(userId: string, meetingId: string) {
  const supabase = await createServiceRoleClient();

  const { data: meeting } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("id", meetingId)
    .eq("user_id", userId)
    .single();

  if (!meeting) {
    throw new Error("Meeting not found");
  }

  const lookbackStart = new Date(
    new Date(meeting.start_at).getTime() - 48 * 60 * 60 * 1000
  ).toISOString();

  const { data: signals } = await supabase
    .from("signals")
    .select(
      "id, title, snippet, sender_name, sender_email, topic_cluster, urgency_score, received_at"
    )
    .eq("user_id", userId)
    .gte("received_at", lookbackStart)
    .lte("received_at", meeting.start_at)
    .order("urgency_score", { ascending: false, nullsFirst: false })
    .order("received_at", { ascending: false })
    .limit(8);

  const relatedSignals = (signals ?? []) as MeetingBriefSignal[];
  const topics = uniqueStrings(relatedSignals.map((signal) => signal.topic_cluster)).slice(0, 4);

  const prepActions = uniqueStrings([
    (meeting.prep_time_needed_minutes ?? 0) > 0 && !meeting.has_prep_block
      ? `Reserve ${meeting.prep_time_needed_minutes} minutes to prep before the meeting`
      : null,
    meeting.ownership_load === "organizer"
      ? "Define the decision and desired outcome before the meeting starts"
      : null,
    meeting.ownership_load === "presenter"
      ? "Prepare the key points you need to present and the evidence behind them"
      : null,
    meeting.decision_density === "high"
      ? "Write down the 2-3 decisions that must be made in this meeting"
      : null,
    meeting.efficiency_risks?.includes("too_many_attendees")
      ? "Identify the core decision-maker so the meeting does not diffuse"
      : null,
    meeting.efficiency_risks?.includes("no_agenda")
      ? "Draft a one-line agenda before the meeting begins"
      : null,
    topics.length
      ? `Review the latest context on: ${topics.join(", ")}`
      : null,
  ]);

  const decisionsToMake = uniqueStrings([
    meeting.decision_density === "high"
      ? "Confirm the primary decision this meeting needs to land"
      : null,
    meeting.ownership_load === "organizer"
      ? "Decide what outcome you need from attendees"
      : null,
    meeting.ownership_load === "presenter"
      ? "Decide what recommendation or position you are asking others to accept"
      : null,
    topics[0] ? `Clarify your stance on ${topics[0]}` : null,
    topics[1] ? `Identify the unresolved question around ${topics[1]}` : null,
  ]);

  const riskReasons = uniqueStrings(
    (meeting.efficiency_risks ?? []).map((risk: string) => riskLabelMap[risk] ?? risk)
  );

  return {
    meeting: {
      id: meeting.id,
      title: meeting.title,
      startAt: meeting.start_at,
      endAt: meeting.end_at,
      attendeeCount: meeting.attendee_count,
      decisionDensity: meeting.decision_density,
      ownershipLoad: meeting.ownership_load,
      prepTimeNeededMinutes: meeting.prep_time_needed_minutes,
      hasPrepBlock: meeting.has_prep_block,
      risks: meeting.efficiency_risks ?? [],
      description: meeting.description?.slice(0, 600) ?? null,
    },
    riskReasons,
    topics,
    prepActions,
    decisionsToMake,
    relatedSignals: relatedSignals.map((signal) => ({
      id: signal.id,
      title: signal.title,
      snippet: signal.snippet,
      senderName: signal.sender_name,
      senderEmail: signal.sender_email,
      topic: signal.topic_cluster,
      urgencyScore: signal.urgency_score,
      receivedAt: signal.received_at,
    })),
  };
}

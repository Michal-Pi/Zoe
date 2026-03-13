// Deterministic meeting classification — replaces the Haiku generateObject call.
// Classifies calendar events by title/description patterns, attendee count,
// organizer status, and duration.

interface MeetingInput {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  is_organizer: boolean;
  attendee_count: number;
  is_recurring: boolean;
  location: string | null;
}

export interface MeetingClassificationResult {
  event_id: string;
  decision_density: "high" | "medium" | "low";
  ownership_load: "organizer" | "presenter" | "contributor" | "passive";
  efficiency_risks: string[];
  prep_time_needed_minutes: number;
}

// ── Title pattern detection ──────────────────────────────────────

const HIGH_DENSITY_PATTERNS = [
  /\b(strategy|strategic)\b/i,
  /\b(budget|financial|forecast)\b/i,
  /\b(roadmap|planning)\b/i,
  /\b(hiring|headcount|recruiting)\b/i,
  /\b(architecture|design review)\b/i,
  /\b(board|exec|leadership)\b/i,
  /\b(kickoff|kick-off)\b/i,
  /\b(quarterly|annual) review\b/i,
  /\bqbr\b/i,
  /\b(decision|approval)\b/i,
  /\bpostmortem\b/i,
  /\bretro(spective)?\b/i,
];

const LOW_DENSITY_PATTERNS = [
  /\b(standup|stand-up|daily)\b/i,
  /\b(social|coffee|lunch|happy hour)\b/i,
  /\b(1[:\-]1|one[- ]on[- ]one|1 on 1)\b/i,
  /\b(check[- ]?in)\b/i,
  /\b(sync|catchup|catch-up)\b/i,
  /\b(all[- ]?hands|town[- ]?hall)\b/i,
  /\b(training|workshop|learning)\b/i,
  /\b(watercooler|team building)\b/i,
];

const PRESENTER_PATTERNS = [
  /\b(demo|presentation|present)\b/i,
  /\b(review|walkthrough|walk-through)\b/i,
  /\b(show and tell|show & tell)\b/i,
  /\b(pitch|proposal)\b/i,
];

function classifyDecisionDensity(
  title: string,
  description: string | null,
  attendeeCount: number,
  durationMinutes: number
): "high" | "medium" | "low" {
  const text = `${title} ${description ?? ""}`;

  if (HIGH_DENSITY_PATTERNS.some((p) => p.test(text))) return "high";
  if (LOW_DENSITY_PATTERNS.some((p) => p.test(text))) return "low";

  // Long meetings with many attendees tend to be higher density
  if (durationMinutes >= 60 && attendeeCount >= 5) return "high";

  // Short meetings are usually low density
  if (durationMinutes <= 15) return "low";

  return "medium";
}

function classifyOwnershipLoad(
  title: string,
  description: string | null,
  isOrganizer: boolean,
  attendeeCount: number
): "organizer" | "presenter" | "contributor" | "passive" {
  const text = `${title} ${description ?? ""}`;

  if (isOrganizer) return "organizer";
  if (PRESENTER_PATTERNS.some((p) => p.test(text))) return "presenter";

  // Large meetings where you're not the organizer → likely passive
  if (attendeeCount > 10) return "passive";

  return "contributor";
}

function detectEfficiencyRisks(
  title: string,
  description: string | null,
  attendeeCount: number,
  isRecurring: boolean,
  decisionDensity: "high" | "medium" | "low"
): string[] {
  const risks: string[] = [];

  // No agenda
  const hasDescription = description && description.trim().length > 20;
  const hasVagueTitle = title.length < 10 || /^(meeting|call|sync|chat)$/i.test(title.trim());
  if (!hasDescription && hasVagueTitle) {
    risks.push("no_agenda");
  }

  // Too many attendees
  if (attendeeCount > 8) {
    risks.push("too_many_attendees");
  }

  // Recurring stale — recurring with generic title and no description
  if (isRecurring && !hasDescription && hasVagueTitle) {
    risks.push("recurring_stale");
  }

  // No prep time for high-density meetings (detected later via back-to-back check)
  if (decisionDensity === "high") {
    risks.push("no_prep_time");
  }

  return risks;
}

function estimatePrepMinutes(
  decisionDensity: "high" | "medium" | "low",
  ownershipLoad: "organizer" | "presenter" | "contributor" | "passive"
): number {
  if (ownershipLoad === "passive") return 0;

  if (ownershipLoad === "presenter") {
    return decisionDensity === "high" ? 45 : 30;
  }

  switch (decisionDensity) {
    case "high":
      return 30;
    case "medium":
      return 15;
    case "low":
      return 0;
  }
}

export function classifyMeetingsDeterministically(
  meetings: MeetingInput[]
): MeetingClassificationResult[] {
  return meetings.map((meeting) => {
    const durationMs =
      new Date(meeting.end_at).getTime() - new Date(meeting.start_at).getTime();
    const durationMinutes = Math.round(durationMs / (60 * 1000));

    const decisionDensity = classifyDecisionDensity(
      meeting.title,
      meeting.description,
      meeting.attendee_count,
      durationMinutes
    );

    const ownershipLoad = classifyOwnershipLoad(
      meeting.title,
      meeting.description,
      meeting.is_organizer,
      meeting.attendee_count
    );

    const efficiencyRisks = detectEfficiencyRisks(
      meeting.title,
      meeting.description,
      meeting.attendee_count,
      meeting.is_recurring,
      decisionDensity
    );

    const prepMinutes = estimatePrepMinutes(decisionDensity, ownershipLoad);

    return {
      event_id: meeting.id,
      decision_density: decisionDensity,
      ownership_load: ownershipLoad,
      efficiency_risks: efficiencyRisks,
      prep_time_needed_minutes: prepMinutes,
    };
  });
}

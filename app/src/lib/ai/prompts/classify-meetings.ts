interface MeetingForClassification {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  isOrganizer: boolean;
  attendeeCount: number;
  isRecurring: boolean;
  location: string | null;
}

export function buildMeetingClassificationPrompt(
  meetings: MeetingForClassification[],
  userEmail: string
): string {
  const meetingsSection = meetings
    .map(
      (m) =>
        `[${m.id}] "${m.title}"
Time: ${m.startAt} → ${m.endAt}
Role: ${m.isOrganizer ? "Organizer" : "Attendee"}
Attendees: ${m.attendeeCount}
Recurring: ${m.isRecurring ? "Yes" : "No"}
Location: ${m.location ?? "(none)"}
Description: ${m.description?.slice(0, 500) ?? "(no description)"}`
    )
    .join("\n\n---\n\n");

  return `You are Zoe, a personal assistant that classifies calendar meetings for a busy professional (${userEmail}).

For each meeting below, classify:

1. **decision_density**: How many important decisions are expected?
   - high: strategic decisions (budget, roadmap, hiring, architecture)
   - medium: operational decisions, status with action items
   - low: informational, social, standup, 1:1 check-in

2. **ownership_load**: What is the user's expected involvement?
   - organizer: user created it and drives the agenda
   - presenter: user is presenting or demoing (look for "demo", "review", "present" in title)
   - contributor: user expected to provide input
   - passive: user is optional or observing

3. **efficiency_risks**: Any red flags? Choose from:
   - "no_agenda" — no description or vague title
   - "back_to_back" — consider adjacent meetings (you'll see the full schedule)
   - "recurring_stale" — recurring meeting with generic title and no recent description updates
   - "too_many_attendees" — more than 8 attendees
   - "no_prep_time" — high-density meeting with no buffer before it

4. **prep_time_needed_minutes**: 0 for casual, 15 for operational, 30 for strategic, 45-60 for presentations.

Meetings to classify:

${meetingsSection}`;
}

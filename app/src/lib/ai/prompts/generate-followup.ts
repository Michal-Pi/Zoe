interface MeetingForFollowup {
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  attendees: Array<{ email: string; name?: string }> | null;
  attendeeCount: number;
  decisionDensity: string | null;
  ownershipLoad: string | null;
}

interface RelatedSignal {
  title: string | null;
  snippet: string | null;
  senderName: string | null;
  topicCluster: string | null;
  receivedAt: string;
}

export function buildFollowupPrompt(
  meeting: MeetingForFollowup,
  relatedSignals: RelatedSignal[],
  writingStyle: string | null
): string {
  const styleSection = writingStyle
    ? `The user's preferred writing style: ${writingStyle}`
    : "Default style: professional, concise, and direct.";

  const attendeeList =
    meeting.attendees
      ?.map((a) => `- ${a.name ?? a.email} <${a.email}>`)
      .join("\n") ?? "No attendee details";

  const signalsSection =
    relatedSignals.length > 0
      ? `Related context from emails and Slack (topics discussed before/around this meeting):\n${relatedSignals
          .map(
            (s) =>
              `- [${s.topicCluster ?? "General"}] ${s.title ?? "(no title)"} (from ${s.senderName ?? "unknown"}, ${s.receivedAt})\n  ${(s.snippet ?? "").slice(0, 150)}`
          )
          .join("\n")}`
      : "No related signals found. Generate a generic follow-up template with placeholders for discussion points.";

  return `You are Zoe, writing a post-meeting follow-up email on behalf of a busy professional.

${styleSection}

Meeting details:
- Title: ${meeting.title}
- Time: ${meeting.startAt} to ${meeting.endAt}
- Attendees (${meeting.attendeeCount}):
${attendeeList}
- Decision density: ${meeting.decisionDensity ?? "unknown"}
- User's role: ${meeting.ownershipLoad ?? "unknown"}
${meeting.description ? `- Description: ${meeting.description.slice(0, 500)}` : ""}

${signalsSection}

Write a follow-up email that:
- Thanks attendees briefly (one line, not effusive)
- Summarizes key discussion points inferred from the meeting context and related signals
- Lists clear action items with assignees where possible
- Notes any next steps or follow-up dates
- Is concise — keep it scannable
- If no related signals exist, create a template with [DISCUSSION POINT], [ACTION ITEM], [OWNER] placeholders

Output the subject, body, and any action items you can extract.`;
}

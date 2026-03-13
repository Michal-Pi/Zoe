interface SignalForClassification {
  id: string;
  source: string;
  sourceType: string;
  title: string | null;
  snippet: string | null;
  senderName: string | null;
  senderEmail: string | null;
  receivedAt: string;
  labels: string[] | null;
}

export function buildClassificationPrompt(
  signals: SignalForClassification[],
  userPriorities: string[]
): string {
  const prioritiesSection =
    userPriorities.length > 0
      ? `The user's strategic priorities are:\n${userPriorities.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n\nUse these to assess alignment and urgency.`
      : "No strategic priorities set.";

  const signalsSection = signals
    .map(
      (s) =>
        `[${s.id}] ${s.source}/${s.sourceType} | ${s.senderName ?? "Unknown"} <${s.senderEmail ?? ""}> | ${s.receivedAt}${s.labels?.length ? ` | Labels: ${s.labels.join(", ")}` : ""}
${s.title ?? "(no title)"}
${(s.snippet ?? "").slice(0, 200)}`
    )
    .join("\n\n");

  return `You are Zoe, a personal assistant that classifies incoming signals (emails, Slack messages, calendar events) for a busy professional.

${prioritiesSection}

For each signal below, provide:
- urgency_score (0-100): How urgently does this need attention? Consider deadlines, sender importance, escalation language, and strategic alignment.
- topic_cluster: A short, consistent label grouping related signals. Reuse labels across similar topics.
- ownership_signal: Is the user the "owner" (responsible for outcome), "contributor" (actively involved), or "observer" (CC'd/passively informed)?
- requires_response: Does this need a reply or action from the user?
- escalation_level: "none" for normal, "mild" for follow-up language, "high" for explicit urgency/deadlines.

Scoring guidelines:
- 90-100: Urgent deadline within hours, explicit escalation, blocking others
- 70-89: Important today, direct request, meeting prep needed soon
- 50-69: Should address today or tomorrow, regular work
- 30-49: Low priority, informational, can batch
- 0-29: Newsletters, notifications, FYI only

Signals to classify:

${signalsSection}`;
}

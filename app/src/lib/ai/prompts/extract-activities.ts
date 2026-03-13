// NOTE: This prompt is currently unused. Activity extraction was replaced by
// deterministic scoring in lib/scoring/deterministic-activities.ts (Phase 1).
// Kept for potential reuse in Phase 6 (full-context review route).

interface WorkObjectForExtraction {
  id: string;
  title: string;
  description: string | null;
  signals: {
    source: string;
    title: string | null;
    snippet: string | null;
    senderName: string | null;
    urgencyScore: number | null;
    requiresResponse: boolean | null;
    receivedAt: string;
  }[];
}

export function buildActivityExtractionPrompt(
  workObjects: WorkObjectForExtraction[],
  userPriorities: string[],
  currentTime: string
): string {
  const prioritiesSection =
    userPriorities.length > 0
      ? `The user's strategic priorities:\n${userPriorities.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
      : "No strategic priorities set.";

  const workObjectsSection = workObjects
    .map((wo) => {
      const signalsList = wo.signals
        .map(
          (s) =>
            `  - [${s.source}] ${s.title ?? "(no title)"} from ${s.senderName ?? "Unknown"} (urgency: ${s.urgencyScore ?? "?"}/100, reply needed: ${s.requiresResponse ?? "?"}) ${(s.snippet ?? "").slice(0, 120)}`
        )
        .join("\n");

      return `Work Object: ${wo.title}
Description: ${wo.description ?? "(none)"}
Signals:\n${signalsList}`;
    })
    .join("\n\n===\n\n");

  return `You are Zoe, a personal assistant that extracts concrete, actionable activities from work objects.

Current time: ${currentTime}

${prioritiesSection}

For each work object below, extract the activities (tasks) the user needs to do. Be specific and actionable.

Scoring guidelines:
- urgency (0-100): Time pressure. Deadlines, escalation language, blocking others.
- importance (0-100): Strategic value. Alignment with priorities, sender seniority, business impact.
- effort (0-100): Inverse of effort — high score = quick win, low score = large effort needed.
- strategic_alignment (0-100): How well it aligns with the user's stated priorities.

Final score = weighted average: urgency(30%) + importance(30%) + effort(20%) + strategic_alignment(20%)

Horizon guidelines:
- "now": Needs attention today. Has a deadline today, explicit urgency, or is blocking someone.
- "soon": Should be done this week. Important but not time-critical.
- "strategic": Longer-term. No immediate deadline, contributes to goals over time.

Batch guidelines:
- Group similar small tasks (e.g., multiple email replies, Slack catch-ups) with matching batch_key values.
- Only batch tasks that are < 15 minutes and similar in nature.

Work objects to process:

${workObjectsSection}`;
}

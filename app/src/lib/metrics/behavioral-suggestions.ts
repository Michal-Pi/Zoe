import type { BehavioralSuggestionData } from "@/domain/dashboard";

export type BehavioralSuggestion = BehavioralSuggestionData;

interface MetricsInput {
  reactiveActivityPct: number;
  deepWorkBlocks: number;
  meetingsWithOutcomes: number;
  meetingsTotal: number;
  activitiesCompleted: number;
}

/**
 * Generate rule-based behavioral suggestions from weekly metrics.
 * Returns at most 3 suggestions, prioritized by impact.
 */
export function generateBehavioralSuggestions(
  metrics: MetricsInput
): BehavioralSuggestion[] {
  const suggestions: BehavioralSuggestion[] = [];

  if (metrics.reactiveActivityPct > 60) {
    suggestions.push({
      id: "reduce-reactive",
      title: "Block dedicated deep work time",
      description:
        "Over 60% of your activity is reactive (Slack/email driven). Schedule 1-2 focused blocks per day to shift toward proactive work.",
    });
  }

  if (metrics.deepWorkBlocks === 0) {
    suggestions.push({
      id: "create-deep-work",
      title: "Decline or shorten one meeting",
      description:
        "You had zero deep work blocks this week. Consider declining one low-value meeting to free up a 60+ minute block.",
    });
  }

  if (
    metrics.meetingsTotal > 0 &&
    metrics.meetingsWithOutcomes / metrics.meetingsTotal < 0.5
  ) {
    suggestions.push({
      id: "meeting-outcomes",
      title: "Add outcomes to your meetings",
      description:
        "Less than half your meetings had documented outcomes. Try adding a 2-minute summary at the end of each meeting.",
    });
  }

  if (metrics.activitiesCompleted === 0 && metrics.meetingsTotal > 5) {
    suggestions.push({
      id: "protect-execution",
      title: "Protect execution time",
      description:
        "You had many meetings but completed no activities. Reserve at least 2 hours daily for focused execution.",
    });
  }

  return suggestions.slice(0, 3);
}

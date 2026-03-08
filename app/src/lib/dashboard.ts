import type { DashboardData, Intervention, RealityBrief } from "@/domain/dashboard";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Compute how many meaningful tasks fit in available time */
function computeMaxTasks(availableMinutes: number): number {
  if (availableMinutes < 60) return 1;
  if (availableMinutes < 120) return 2;
  if (availableMinutes < 180) return 3;
  if (availableMinutes < 300) return 4;
  return 5;
}

/** Generate interventions based on current reality */
export function generateInterventions(
  reality: RealityBrief
): Intervention[] {
  const interventions: Intervention[] = [];

  if (reality.availableExecutionMinutes < 120 && reality.meetingCount > 3) {
    interventions.push({
      id: "protect-deep-work",
      title: "Protect 60 minutes of deep work before 2pm",
      description:
        "Your calendar is packed. Block a focus slot now or it won't happen.",
      type: "protect",
      priority: "high",
      timeEstimateMinutes: 60,
    });
  }

  if (reality.openLoops > 3) {
    interventions.push({
      id: "close-loops",
      title: `Close ${reality.openLoops} stale loops`,
      description:
        "These threads are older than 48 hours. Respond or explicitly close them.",
      type: "batch",
      priority: "high",
      timeEstimateMinutes: Math.min(reality.openLoops * 5, 30),
    });
  }

  if (reality.activeSlackThreads > 8) {
    interventions.push({
      id: "batch-slack",
      title: "Batch Slack at a fixed time instead of responding continuously",
      description: `You have ${reality.activeSlackThreads} active threads. Pick two 15-minute windows.`,
      type: "batch",
      priority: "medium",
      timeEstimateMinutes: 30,
    });
  }

  if (reality.meetingCount > 5) {
    interventions.push({
      id: "reduce-meetings",
      title: "Review if all meetings require your presence",
      description:
        "With 5+ meetings, check if any can be skipped or shortened.",
      type: "cancel",
      priority: "medium",
    });
  }

  return interventions;
}

/** Build mock dashboard data for development/demo */
export function getMockDashboardData(): DashboardData {
  const realityBrief: RealityBrief = {
    availableExecutionMinutes: 130,
    totalMeetingMinutes: 320,
    meetingCount: 5,
    activeSlackThreads: 11,
    unreadEmails: 23,
    openLoops: 4,
    maxMeaningfulTasks: computeMaxTasks(130),
  };

  return {
    realityBrief,
    behavioralSnapshot: {
      reactiveActivityPct: 64,
      deepWorkBlocks: 0,
      meetingsWithOutcomes: 2,
      meetingsTotal: 5,
      meetingsPreparedOnTime: 3,
      periodLabel: "This week",
    },
    interventions: generateInterventions(realityBrief),
    suggestions: [],
    greeting: getGreeting(),
  };
}

export { getGreeting, computeMaxTasks };

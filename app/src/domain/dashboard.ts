export interface RealityBrief {
  availableExecutionMinutes: number;
  totalMeetingMinutes: number;
  meetingCount: number;
  activeSlackThreads: number;
  unreadEmails: number;
  openLoops: number;
  maxMeaningfulTasks: number; // derived: if exec time < 3h, suggest ≤3 tasks
}

export type TrendDirection = "improving" | "worsening" | "stable";

export interface BehavioralSnapshot {
  reactiveActivityPct: number; // 0-100
  deepWorkBlocks: number; // blocks >60min this week
  meetingsWithOutcomes: number;
  meetingsTotal: number;
  meetingsPreparedOnTime: number;
  periodLabel: string; // "This week" or "Last 7 days"
  reactiveActivityTrend?: TrendDirection;
  deepWorkTrend?: TrendDirection;
}

export interface Intervention {
  id: string;
  title: string;
  description: string;
  type: "protect" | "prepare" | "batch" | "delegate" | "cancel";
  priority: "high" | "medium" | "low";
  timeEstimateMinutes?: number;
  relatedMeetingTitle?: string;
}

export interface BehavioralSuggestionData {
  id: string;
  title: string;
  description: string;
}

export interface DashboardData {
  realityBrief: RealityBrief;
  behavioralSnapshot: BehavioralSnapshot | null;
  interventions: Intervention[];
  suggestions: BehavioralSuggestionData[];
  greeting: string;
}

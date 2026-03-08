export interface Signal {
  id: string;
  userId: string;
  source: "gmail" | "slack" | "google_calendar";
  sourceType: "email" | "slack_message" | "slack_thread" | "calendar_event";
  externalId: string;
  threadId: string | null;

  title: string | null;
  snippet: string | null;
  senderName: string | null;
  senderEmail: string | null;
  participants: string[] | null;

  receivedAt: string;
  isRead: boolean;
  isStarred: boolean;
  labels: string[] | null;

  // Calendar-specific
  eventStart: string | null;
  eventEnd: string | null;
  isRecurring: boolean;
  isOrganizer: boolean;

  // AI-enriched
  urgencyScore: number | null;
  topicCluster: string | null;
  ownershipSignal: "owner" | "contributor" | "observer" | null;
  requiresResponse: boolean | null;
  escalationLevel: "none" | "mild" | "high" | null;

  ingestedAt: string;
  classifiedAt: string | null;
}

export interface WorkObject {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  signalCount: number;
  latestSignalAt: string | null;
  status: "active" | "resolved" | "snoozed";
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  userId: string;
  workObjectId: string | null;

  title: string;
  description: string | null;
  timeEstimateMinutes: number | null;

  score: number;
  scoreRationale: string[] | null;
  scoringFactors: Record<string, number> | null;

  horizon: "now" | "soon" | "strategic";
  triggerDescription: string | null;
  triggerAt: string | null;
  deadlineAt: string | null;

  status: "pending" | "in_progress" | "completed" | "snoozed" | "dismissed";
  startedAt: string | null;
  completedAt: string | null;
  snoozedUntil: string | null;
  isPinned: boolean;

  batchKey: string | null;
  batchLabel: string | null;
  parentActivityId: string | null;

  scoredAt: string;
  createdAt: string;
  updatedAt: string;
}

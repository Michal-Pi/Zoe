export interface DraftReviewMetadata {
  warnings?: string[];
  rationale?: string[];
  approvedBody?: string;
  approvedSubject?: string;
  approvedToEmail?: string;
}

export interface DraftReply {
  id: string;
  userId: string;
  activityId: string | null;
  signalId: string | null;
  meetingId: string | null;

  toEmail: string;
  subject: string;
  body: string;
  tone: "professional" | "casual" | "direct" | "empathetic";

  draftType: "reply" | "follow_up";

  status: "pending" | "accepted" | "edited" | "sent" | "discarded";
  editedBody: string | null;
  acceptedAt: string | null;
  reviewMetadata: DraftReviewMetadata | null;
  sentAt: string | null;
  discardedAt: string | null;

  modelUsed: string;
  promptTokens: number | null;
  completionTokens: number | null;

  createdAt: string;
  updatedAt: string;
}

export interface SlackDraft {
  id: string;
  userId: string;
  activityId: string | null;
  signalId: string | null;

  channelId: string;
  channelLabel: string | null;
  message: string;
  editedMessage: string | null;
  threadTs: string | null;

  status: "pending" | "accepted" | "edited" | "sent" | "discarded";
  acceptedAt: string | null;
  reviewMetadata: DraftReviewMetadata | null;
  sentAt: string | null;
  discardedAt: string | null;

  modelUsed: string;
  createdAt: string;
  updatedAt: string;
}

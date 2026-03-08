export interface CalendarEvent {
  id: string;
  userId: string;
  externalId: string;
  connectionId: string | null;

  title: string;
  description: string | null;
  location: string | null;
  startAt: string; // ISO timestamp
  endAt: string;
  isAllDay: boolean;
  isRecurring: boolean;
  recurrenceRule: string | null;

  organizerEmail: string | null;
  isOrganizer: boolean;
  attendees: Attendee[] | null;
  attendeeCount: number;

  // AI classification
  decisionDensity: "high" | "medium" | "low" | null;
  ownershipLoad: "organizer" | "presenter" | "contributor" | "passive" | null;
  efficiencyRisks: string[] | null;
  prepTimeNeededMinutes: number | null;
  hasPrepBlock: boolean;

  syncedAt: string;
}

export interface Attendee {
  email: string;
  name?: string;
  responseStatus: "accepted" | "declined" | "tentative" | "needsAction";
}

export interface IntegrationConnection {
  id: string;
  userId: string;
  provider: "google" | "slack";
  providerAccountId: string | null;
  email: string | null;
  scopes: string[] | null;
  status: "active" | "revoked" | "expired";
  connectedAt: string;
  lastSyncAt: string | null;
}

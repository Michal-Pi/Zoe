import { getValidAccessToken } from "./google-auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

interface GoogleEvent {
  id: string;
  status: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  organizer?: {
    email?: string;
    displayName?: string;
    self?: boolean;
  };
  creator?: {
    email?: string;
    displayName?: string;
  };
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: string;
    self?: boolean;
    organizer?: boolean;
    optional?: boolean;
  }>;
  recurrence?: string[];
  recurringEventId?: string;
  etag?: string;
  iCalUID?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ uri?: string }>;
  };
  updated?: string;
}

interface EventsListResponse {
  items?: GoogleEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

interface CreateCalendarEventInput {
  summary: string;
  description?: string;
  start: string;
  end: string;
}

/** Fetch all events from Google Calendar with pagination */
async function fetchAllEvents(
  connectionId: string,
  calendarId: string,
  options: {
    timeMin?: string;
    timeMax?: string;
    syncToken?: string;
  }
): Promise<{ events: GoogleEvent[]; nextSyncToken?: string }> {
  const allEvents: GoogleEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;

  const MAX_PAGES = 10;
  let pageCount = 0;

  do {
    if (pageCount++ >= MAX_PAGES) break;
    const accessToken = await getValidAccessToken(connectionId);
    const params = new URLSearchParams({
      singleEvents: "true",
      showDeleted: "true",
      maxResults: "250",
    });

    if (options.syncToken) {
      params.set("syncToken", options.syncToken);
    } else {
      if (options.timeMin) params.set("timeMin", options.timeMin);
      if (options.timeMax) params.set("timeMax", options.timeMax);
    }

    if (pageToken) params.set("pageToken", pageToken);

    const url = `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 410) {
      // Sync token expired — caller should retry with full sync
      throw new SyncTokenExpiredError();
    }

    if (!response.ok) {
      throw new Error(
        `Calendar API error: ${response.status} ${await response.text()}`
      );
    }

    const data: EventsListResponse = await response.json();
    if (data.items) allEvents.push(...data.items);
    pageToken = data.nextPageToken;
    nextSyncToken = data.nextSyncToken;
  } while (pageToken);

  return { events: allEvents, nextSyncToken };
}

/** Normalize a Google Calendar event to our schema */
function normalizeEvent(
  raw: GoogleEvent,
  userId: string,
  connectionId: string
): Record<string, unknown> {
  const isAllDay = Boolean(raw.start?.date && !raw.start?.dateTime);
  const startIso =
    raw.start?.dateTime ?? (raw.start?.date ? `${raw.start.date}T00:00:00Z` : null);
  const endIso = isAllDay
    ? // Google uses exclusive end date for all-day events
      (() => {
        const d = new Date(raw.end!.date!);
        d.setDate(d.getDate() - 1);
        return `${d.toISOString().split("T")[0]}T23:59:59Z`;
      })()
    : raw.end?.dateTime ?? null;

  const isOrganizer = raw.organizer?.self ?? false;
  const attendeeCount = raw.attendees?.length ?? 0;

  return {
    user_id: userId,
    external_id: raw.id,
    connection_id: connectionId,
    title: raw.summary ?? "(No title)",
    description: raw.description ?? null,
    location: raw.location ?? null,
    start_at: startIso,
    end_at: endIso,
    is_all_day: isAllDay,
    is_recurring: Boolean(raw.recurringEventId || raw.recurrence?.length),
    recurrence_rule: raw.recurrence?.join("\n") ?? null,
    organizer_email: raw.organizer?.email ?? null,
    is_organizer: isOrganizer,
    attendees: raw.attendees
      ? raw.attendees.map((a) => ({
          email: a.email,
          name: a.displayName,
          responseStatus: a.responseStatus ?? "needsAction",
        }))
      : null,
    attendee_count: attendeeCount,
    etag: raw.etag ?? null,
    synced_at: new Date().toISOString(),
  };
}

/** Sync calendar events from Google to Supabase */
export async function syncCalendarEvents(
  userId: string,
  connectionId: string,
  calendarId: string = "primary"
): Promise<{ synced: number; deleted: number }> {
  const supabase = await createServiceRoleClient();

  // Check for existing sync token
  const { data: syncState } = await supabase
    .from("calendar_sync_state")
    .select("sync_token")
    .eq("connection_id", connectionId)
    .eq("calendar_id", calendarId)
    .single();

  let events: GoogleEvent[];
  let nextSyncToken: string | undefined;

  try {
    if (syncState?.sync_token) {
      // Incremental sync
      const result = await fetchAllEvents(connectionId, calendarId, {
        syncToken: syncState.sync_token,
      });
      events = result.events;
      nextSyncToken = result.nextSyncToken;
    } else {
      // Full sync — fetch last 14 days + next 30 days
      const timeMin = new Date(
        Date.now() - 14 * 24 * 60 * 60 * 1000
      ).toISOString();
      const timeMax = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString();

      const result = await fetchAllEvents(connectionId, calendarId, {
        timeMin,
        timeMax,
      });
      events = result.events;
      nextSyncToken = result.nextSyncToken;
    }
  } catch (e) {
    if (e instanceof SyncTokenExpiredError) {
      // Clear sync token and do full sync
      await supabase
        .from("calendar_sync_state")
        .delete()
        .eq("connection_id", connectionId)
        .eq("calendar_id", calendarId);

      const timeMin = new Date(
        Date.now() - 14 * 24 * 60 * 60 * 1000
      ).toISOString();
      const timeMax = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString();

      const result = await fetchAllEvents(connectionId, calendarId, {
        timeMin,
        timeMax,
      });
      events = result.events;
      nextSyncToken = result.nextSyncToken;
    } else {
      throw e;
    }
  }

  // Process events
  let synced = 0;
  let deleted = 0;

  for (const event of events) {
    if (event.status === "cancelled") {
      // Delete cancelled events
      await supabase
        .from("calendar_events")
        .delete()
        .eq("user_id", userId)
        .eq("external_id", event.id);
      deleted++;
    } else {
      // Upsert event
      const normalized = normalizeEvent(event, userId, connectionId);
      await supabase
        .from("calendar_events")
        .upsert(normalized, { onConflict: "user_id,external_id" });
      synced++;
    }
  }

  // Store sync token for next incremental sync
  if (nextSyncToken) {
    await supabase.from("calendar_sync_state").upsert(
      {
        connection_id: connectionId,
        calendar_id: calendarId,
        sync_token: nextSyncToken,
        last_sync_at: new Date().toISOString(),
      },
      { onConflict: "connection_id,calendar_id" }
    );
  }

  // Update connection last_sync_at
  await supabase
    .from("integration_connections")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", connectionId);

  return { synced, deleted };
}

class SyncTokenExpiredError extends Error {
  constructor() {
    super("Sync token expired (410 Gone)");
    this.name = "SyncTokenExpiredError";
  }
}

export async function createCalendarEvent(
  connectionId: string,
  input: CreateCalendarEventInput,
  calendarId: string = "primary"
): Promise<{ id: string }> {
  const accessToken = await getValidAccessToken(connectionId);

  const response = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description ?? "",
        start: { dateTime: input.start },
        end: { dateTime: input.end },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Calendar create event error: ${response.status} ${await response.text()}`
    );
  }

  const data = (await response.json()) as { id: string };
  return { id: data.id };
}

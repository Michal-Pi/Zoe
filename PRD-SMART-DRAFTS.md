# PRD: Smart Drafts & Inbox Intelligence

## Overview

This feature set adds proactive intelligence to Zoe's email and communication handling, closing the competitive gap with Fyxer.ai while leveraging Zoe's unique priority engine. Rather than just classifying signals, Zoe will now act on them — generating draft replies, syncing labels back to Gmail, producing post-meeting follow-ups, and finding available meeting times.

## Features

### Feature 1: Proactive Email Draft Generation

**What:** When the classification pipeline marks an email as `requires_response: true`, Zoe auto-generates a draft reply and attaches it to the corresponding activity card in the Command Center.

**Why:** Fyxer's #1 feature. Reduces the cognitive load of going from "I need to reply" to "here's what I'd say." Users get a head start on every email that needs action.

**User Experience:**
1. Email arrives and is synced to signals table
2. Cron classifies it: `requires_response: true`, `urgency_score: 75`
3. Scoring engine creates an activity: "Reply to Sarah's budget proposal"
4. A new pipeline step generates a draft reply using Sonnet 4.6
5. Draft is stored in a new `draft_replies` table, linked to the activity
6. Activity card in Command Center shows a "Draft ready" badge
7. User clicks "View Draft" on the activity card
8. Draft opens in a review panel (inline or slide-over) with Edit / Send / Discard buttons
9. User edits if needed, clicks Send, email is sent via Gmail API
10. Activity auto-completes

**Draft Generation Logic:**
- Input: original email (title, snippet, full body if available), sender info, thread context (previous messages in thread), user's strategic priorities, user's writing style preferences
- Model: Sonnet 4.6 (user-facing quality)
- Output: subject line (for replies: "Re: ..."), body text, tone label (formal/casual/direct)
- Style learning: initially use a system prompt with professional defaults. Add a `writing_style_notes` TEXT field to profiles where users can describe their preferred tone (e.g., "Direct and concise, no fluff, sign off with 'Best,'")

**Acceptance Criteria:**
- Drafts generated within 5 minutes of signal classification
- Draft quality: usable with minor edits by 70%+ of users
- Drafts include context from the thread (not just the latest message)
- User can edit, send, or discard from the activity card
- Sent replies tracked as a completed activity
- Cost per draft: <$0.02 (Sonnet, ~500 input + 200 output tokens)

**Data Model Changes:**
```sql
CREATE TABLE draft_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  signal_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,

  -- Draft content
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  tone TEXT DEFAULT 'professional', -- professional, casual, direct, empathetic

  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, edited, sent, discarded
  edited_body TEXT, -- user's edited version (null if sent as-is)
  sent_at TIMESTAMPTZ,
  discarded_at TIMESTAMPTZ,

  -- Generation metadata
  model_used TEXT NOT NULL DEFAULT 'sonnet',
  prompt_tokens INTEGER,
  completion_tokens INTEGER,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(signal_id) -- one draft per signal
);

ALTER TABLE draft_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own drafts"
  ON draft_replies FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add writing style to profiles
ALTER TABLE profiles ADD COLUMN writing_style_notes TEXT;
```

**API Routes:**
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/drafts/[id]` | GET | Fetch a single draft for review |
| `/api/drafts/[id]` | PATCH | Update draft body (user edits) |
| `/api/drafts/[id]/send` | POST | Send the draft via Gmail API |
| `/api/drafts/[id]/discard` | POST | Mark draft as discarded |

**New Cron Step:**
Add to `/api/cron/score` (after activity extraction) or as a new `/api/cron/drafts` (every 3 min):
1. Query activities linked to signals where `requires_response = true`
2. Filter to activities that don't yet have a `draft_replies` row
3. For each, fetch the signal's full email thread context
4. Call Sonnet 4.6 to generate draft
5. Store in `draft_replies`

**New AI Prompt:** `lib/ai/prompts/generate-draft-reply.ts`
```
You are writing an email reply on behalf of the user.

User's writing style: {{writing_style_notes || "Professional, concise, and direct"}}
User's strategic priorities: {{priorities}}

Original email:
From: {{sender_name}} <{{sender_email}}>
Subject: {{subject}}
Body: {{body}}

Thread context (previous messages):
{{thread_context}}

Write a reply that:
- Matches the user's preferred tone and style
- Addresses the key points in the email
- Is actionable and specific (not vague)
- Is concise (aim for 3-5 sentences unless the topic demands more)
- Does NOT include a greeting line if the thread is informal
- Signs off appropriately for the detected tone
```

**UI Changes:**
- Activity card: Add "Draft ready" badge (green dot) when a draft exists
- Activity card: Add "View Draft" button that opens a slide-over panel
- Draft review panel: Shows To, Subject, Body (editable textarea), Send/Discard buttons
- Settings page: Add "Writing Style" section with a textarea for style notes

---

### Feature 2: Gmail Label Sync

**What:** Write Zoe's signal classifications back to Gmail as color-coded labels, so users see the organization in their inbox — not just inside Zoe.

**Why:** Users spend most time in Gmail, not in Zoe. Making Zoe's intelligence visible in Gmail reinforces value and reduces the need to context-switch.

**Label Mapping:**
| Zoe Classification | Gmail Label | Color (bg / text) |
|--------------------|-------------|---------------------|
| `requires_response: true` + urgency >= 70 | `Zoe/Respond Now` | `#fb4c2f` / `#ffffff` (red) |
| `requires_response: true` + urgency < 70 | `Zoe/To Reply` | `#fad165` / `#000000` (amber) |
| `ownership_signal: 'owner'` | `Zoe/You Own This` | `#a479e2` / `#ffffff` (purple) |
| `requires_response: false` + informational | `Zoe/FYI` | `#4a86e8` / `#ffffff` (blue) |
| `escalation_level: 'high'` | `Zoe/Escalation` | `#fb4c2f` / `#ffffff` (red) |
| All others | `Zoe/Processed` | `#c2c2c2` / `#000000` (gray) |

Note: Gmail API only accepts colors from a predefined palette (~80 pairs). The colors above are verified valid pairs. Both `backgroundColor` and `textColor` are required.

**Implementation:**

1. **Create labels on first connect:** When Google OAuth completes and initial sync runs, create the `Zoe/*` label set in the user's Gmail account via `POST /gmail/v1/users/me/labels`

2. **Apply labels after classification:** After the classify cron updates a signal, call `POST /gmail/v1/users/me/messages/{id}/modify` with `addLabelIds` to apply the appropriate label. Also remove any previous Zoe labels (`removeLabelIds`) to handle reclassification.

3. **New function:** `lib/integrations/gmail-labels.ts`
   - `ensureZoeLabels(connectionId)` — creates label set if not exists, returns label ID map
   - `applyZoeLabel(connectionId, messageId, labelName)` — applies label to message
   - `syncLabelsForSignals(userId, connectionId, signalIds)` — batch apply labels after classification

**Gmail API Details:**
- `gmail.modify` scope (already requested) covers label creation and message modification
- Label creation: `POST /gmail/v1/users/me/labels` with `{ name: "Zoe/Respond Now", color: { backgroundColor: "#cc3a21", textColor: "#ffffff" } }`
- Label application: `POST /gmail/v1/users/me/messages/{id}/modify` with `{ addLabelIds: ["Label_123"] }`
- Store label IDs in a new `gmail_label_configs` table or as JSON in `integration_connections.metadata`

**Data Model Changes:**
```sql
-- Store created Gmail label IDs per connection
ALTER TABLE integration_connections ADD COLUMN metadata JSONB DEFAULT '{}';
-- metadata.gmail_labels = { "respond_now": "Label_123", "to_reply": "Label_456", ... }
```

**Acceptance Criteria:**
- Labels created on first sync, not duplicated on subsequent syncs
- Labels applied within 5 minutes of classification (same cron cycle)
- Reclassification updates labels (removes old, adds new)
- Disconnecting Google removes labels from Gmail (cleanup)
- Label colors match the specification

---

### Feature 3: Post-Meeting Follow-up Drafts

**What:** After a meeting ends, Zoe automatically generates a follow-up email draft to participants with action items and key points.

**Why:** Follow-ups are one of the highest-value, most-procrastinated tasks. Fyxer does this with meeting transcription. Zoe can do it without transcription by using the meeting context + related signals.

**Trigger:** Cron job checks for meetings that ended in the last 15 minutes and don't yet have a follow-up draft.

**Logic:**
1. `/api/cron/sync` already syncs calendar events
2. New step (or new cron `/api/cron/followups`, every 5 min): query `calendar_events` where `end_at` is between 15 min ago and now, `decision_density` is 'high' or 'medium', and no follow-up draft exists yet
3. For each meeting, gather context:
   - Meeting title, description, attendees, duration, decision density
   - Related signals from the same topic cluster (emails, Slack threads about the meeting topic)
   - The user's role (organizer, contributor, passive)
4. Generate follow-up email draft (Sonnet 4.6):
   - To: meeting attendees (or just organizer, depending on user's role)
   - Subject: "Follow-up: {{meeting title}}"
   - Body: Key discussion points (inferred from signals), action items (inferred from context), next steps
5. Store in `draft_replies` with a new `draft_type` field ('reply' | 'follow_up')
6. Create an activity: "Send follow-up for {{meeting title}}" with the draft linked

**Data Model Changes:**
```sql
ALTER TABLE draft_replies ADD COLUMN draft_type TEXT NOT NULL DEFAULT 'reply';
-- 'reply' = response to incoming email
-- 'follow_up' = post-meeting follow-up
ALTER TABLE draft_replies ADD COLUMN meeting_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL;
```

**Limitations (no transcription):**
- Follow-up content is inferred from signals + meeting metadata, not from what was actually discussed
- Quality depends on how much email/Slack context exists about the meeting topic
- For meetings with no related signals, generate a generic follow-up template with placeholders

**Acceptance Criteria:**
- Follow-up drafts generated within 15 minutes of meeting end
- Only for meetings classified as high or medium decision density
- User can review, edit, and send — same flow as email drafts
- Follow-ups reference actual context (attendee names, topic from signals)
- No follow-up generated for meetings the user marked as "passive" attendance

---

### Feature 4: Available Time Finder (Chat Tool)

**What:** A new chat tool that lets users ask "Find me 30 minutes to meet with Sarah this week" and get available time slots based on their calendar.

**Why:** Scheduling is a top-3 use case for AI assistants. The calendar sync infrastructure already exists — this is a high-value, low-effort feature.

**Chat Tool Definition:**
```typescript
find_available_times: {
  description: "Find available time slots in the user's calendar for scheduling a meeting.",
  inputSchema: z.object({
    duration_minutes: z.number().int().min(15).max(240).describe("Meeting duration"),
    earliest: z.string().describe("Earliest date to consider (ISO date)"),
    latest: z.string().describe("Latest date to consider (ISO date)"),
    preferred_time: z.enum(["morning", "afternoon", "any"]).default("any"),
    avoid_back_to_back: z.boolean().default(true),
  }),
  execute: async ({ duration_minutes, earliest, latest, preferred_time, avoid_back_to_back }) => {
    // 1. Fetch calendar events in the date range
    // 2. Fetch user's work hours from profile
    // 3. Calculate free slots within work hours
    // 4. Filter by preferred time
    // 5. If avoid_back_to_back, require 15min buffer
    // 6. Return top 5 slots sorted by preference
  }
}
```

**Implementation:** `lib/calendar/find-available-times.ts`
- Input: userId, duration, date range, preferences
- Query `calendar_events` for the date range
- Build a list of busy intervals
- Subtract from work hours to get free intervals
- Split free intervals into slots of the requested duration
- Apply preference filters (morning = before 12pm, afternoon = after 12pm)
- Apply back-to-back buffer if requested
- Return top 5 slots with formatted times

**Response Format:**
```json
{
  "available_slots": [
    { "start": "2026-03-06T10:00:00Z", "end": "2026-03-06T10:30:00Z", "day": "Friday" },
    { "start": "2026-03-06T14:00:00Z", "end": "2026-03-06T14:30:00Z", "day": "Friday" },
    { "start": "2026-03-09T09:00:00Z", "end": "2026-03-09T09:30:00Z", "day": "Monday" }
  ],
  "timezone": "America/New_York"
}
```

**Acceptance Criteria:**
- Returns accurate free slots based on real calendar data
- Respects user's work hours and timezone
- Back-to-back buffer prevents scheduling adjacent to existing meetings
- Works for durations from 15 min to 4 hours
- Response time <2s (database query, no LLM needed)

---

### Feature 5: Meeting Transcription & Notes (Future — Phase 5+)

**What:** Zoe joins video meetings (Zoom, Google Meet, Teams), records audio, transcribes, generates structured notes, and creates follow-up drafts based on actual discussion.

**Why:** This is Fyxer's strongest feature and the single biggest competitive gap. However, it requires significant infrastructure and third-party integration.

**Recommended Phased Approach:**

**Phase 5a: Google Meet REST API (free, start here)**
- Fetch VTT transcripts post-meeting via `GET /v1/conferenceRecords/{id}/transcripts`
- Already have Google OAuth — add Meet scopes
- Free (included with Google Workspace Business Standard+)
- Limitation: Google Meet only, post-meeting only, user must have transcription enabled
- Engineering: 2-3 days

**Phase 5b: Recall.ai (multi-platform, premium add-on)**
- Bot joins Zoom, Google Meet, Teams, Webex — single REST API
- Pricing: $0.50/hour (pay-per-second), volume discounts available
- Real-time transcription + speaker diarization
- No infrastructure to manage (fully hosted)
- At 20 hrs/month meetings: ~$10/user/month → offer as $10/month premium add-on

**Alternatives considered:**
- AssemblyAI ($0.37/hr): transcription-only, still need audio capture separately
- Zoom/Teams native APIs: free but platform-specific, require host to enable recording
- Building in-house: 6+ months of WebRTC engineering vs days with Recall.ai

**Architecture:**
```
Meeting starts (calendar event)
  -> Zoe sends Recall.ai bot to join
  -> Bot records and transcribes
  -> Recall.ai webhook sends transcript to /api/signals/meeting-transcript
  -> Zoe processes: summarize (Sonnet), extract action items, generate follow-up
  -> Notes stored in new meeting_notes table
  -> Follow-up draft auto-generated
```

**Data Model:**
```sql
CREATE TABLE meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  calendar_event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,

  transcript TEXT, -- full transcript
  summary TEXT, -- AI-generated summary
  action_items JSONB, -- [{assignee, action, deadline}]
  key_decisions JSONB, -- [{decision, context}]

  recording_url TEXT,
  duration_seconds INTEGER,

  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(calendar_event_id)
);
```

**Cost Estimate:**
- Google Meet REST API: free (but requires Business Standard+)
- Recall.ai: $0.50/hr * avg 1hr/day meetings * 20 workdays = ~$10/user/month
- LLM summarization: ~$0.05/meeting (Sonnet on ~2K token transcript) = ~$1/user/month
- Total with Recall.ai: ~$11/user/month → must be a premium add-on, not included in base $15

**Decision:** Defer to Phase 5. Start with free Google Meet API, add Recall.ai as paid add-on.
For now, Feature 3 (post-meeting follow-ups without transcription) provides 60% of the value at 0% of the cost.

**Acceptance Criteria (when built):**
- Bot joins meeting within 30 seconds of start time
- Transcript available within 5 minutes of meeting end
- Summary captures key decisions and action items
- Follow-up draft references actual discussion points
- User can opt out of recording per-meeting
- Recording/transcript deleted after 30 days (privacy)

---

## Implementation Plan

### Phase A: Foundation (Sprint 1 — 3-4 days)
1. Database migration: `draft_replies` table, `writing_style_notes` on profiles, `metadata` on integration_connections, `draft_type` + `meeting_id` on draft_replies
2. Gmail labels module: `lib/integrations/gmail-labels.ts`
3. Draft generation prompt: `lib/ai/prompts/generate-draft-reply.ts`
4. Available time finder: `lib/calendar/find-available-times.ts`

### Phase B: Core Pipelines (Sprint 2 — 3-4 days)
5. Draft generation cron: `/api/cron/drafts`
6. Gmail label sync: wire into classifier.ts post-classification
7. Post-meeting follow-up generation: add to sync cron or new cron
8. Chat tool: `find_available_times` in chat-tools.ts

### Phase C: UI (Sprint 3 — 3-4 days)
9. Activity card: "Draft ready" badge + "View Draft" button
10. Draft review panel (slide-over with edit/send/discard)
11. Settings: writing style textarea
12. Chat: render available time slots in a structured card

### Phase D: Polish (Sprint 4 — 2 days)
13. Gmail label cleanup on disconnect
14. Draft quality monitoring (track accept/edit/discard rates)
15. Rate limiting on draft generation (max 20 drafts/day/user)
16. Tests for new modules

---

## Cost Impact

| Feature | Model | Est. Cost/User/Month |
|---------|-------|---------------------|
| Draft generation (~30 drafts/day) | Sonnet 4.6 | $0.60 |
| Gmail label sync | None (API only) | $0.00 |
| Post-meeting follow-ups (~3/day) | Sonnet 4.6 | $0.15 |
| Available time finder | None (DB query) | $0.00 |
| **Total additional** | | **$0.75** |
| **Previous total** | | **$2.30** |
| **New total** | | **$3.05** |

Within the $3/user/month LLM budget (tight but viable). Draft generation is the biggest cost — can be reduced by only drafting for high-urgency emails (urgency >= 50).

---

## Success Metrics

| Metric | Target (1 month post-launch) |
|--------|------------------------------|
| Drafts generated per user per day | 10-30 |
| Draft accept rate (sent as-is) | >30% |
| Draft edit-then-send rate | >40% |
| Draft discard rate | <30% |
| Gmail labels applied per day | 50-200 |
| Follow-up drafts generated per day | 2-5 |
| Time finder usage per week | 3-5 queries |
| User-reported time saved (additional) | +2 hrs/week |

---

## Dependencies

- Features 1-3 depend on Gmail `gmail.modify` scope (already requested)
- Feature 1 depends on full email body access (currently only snippet is synced — need to fetch full body for draft context)
- Feature 4 depends only on existing calendar sync (no new dependencies)
- Feature 5 depends on Recall.ai or Google Meet API (deferred)

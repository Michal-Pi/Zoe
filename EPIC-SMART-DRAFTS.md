# Epic Breakdown: Smart Drafts & Inbox Intelligence

## Overview

4 features across 4 sprints (~2 weeks). Each sprint is independently shippable.

---

## Sprint 1: Foundation (3-4 days)

### Epic SD-1: Database & Core Modules

**Objective:** Schema changes deployed, core library modules built, no UI yet.

**Tasks:**

1. Write SQL migration: `draft_replies` table with RLS
2. Write SQL migration: add `writing_style_notes` to `profiles`
3. Write SQL migration: add `metadata` JSONB to `integration_connections`
4. Write SQL migration: add `draft_type` and `meeting_id` to `draft_replies`
5. Create domain type: `DraftReply` in `domain/signals.ts` (or new `domain/drafts.ts`)
6. Create `lib/ai/prompts/generate-draft-reply.ts` — prompt template for email draft generation
7. Create Zod schema: `lib/ai/schemas/draft-reply.ts` — structured output for drafts
8. Create `lib/integrations/gmail-labels.ts`:
   - `ensureZoeLabels(connectionId)` — idempotent label creation
   - `applyZoeLabel(connectionId, messageExternalId, classification)` — apply label to message
   - `removeZoeLabels(connectionId, messageExternalId)` — remove all Zoe labels
   - `LABEL_MAP` constant mapping classification -> label name + color
9. Create `lib/calendar/find-available-times.ts`:
   - `findAvailableTimes(userId, options)` — returns free slots
   - Pure function: takes events + work hours, returns slots
10. Write unit tests for `find-available-times.ts` (deterministic logic, easy to test)
11. Write unit tests for draft reply Zod schema
12. Apply migrations to Supabase

**Acceptance Criteria:**
- All migrations apply cleanly
- `findAvailableTimes` passes tests for edge cases (no events, fully booked, overnight work hours)
- Gmail labels module compiles and exports correct functions
- Draft prompt template generates reasonable output when tested manually

**Dependencies:** None (pure foundation work)

---

## Sprint 2: Pipelines (3-4 days)

### Epic SD-2: Draft Generation Pipeline

**Objective:** Drafts auto-generated for emails needing response.

**Tasks:**

1. Modify `lib/integrations/gmail.ts`:
   - Add `getMessageBody(connectionId, messageId)` — fetches full message body (not just metadata)
   - Returns plain text body (strips HTML if needed)
2. Create `lib/drafts/generate-draft.ts`:
   - `generateDraftReply(signal, threadContext, userProfile, priorities)` — calls Sonnet 4.6
   - Returns `{ to, subject, body, tone }`
   - Handles thread context: fetches previous messages in thread from signals table
3. Create `/api/cron/drafts/route.ts` — new cron endpoint:
   - Protected by CRON_SECRET
   - Queries all users with active Google connections
   - For each user: finds activities linked to signals with `requires_response = true` that have no draft yet
   - Caps at 20 drafts per user per run
   - Calls `generateDraftReply` for each
   - Stores in `draft_replies` table
4. Register cron in `vercel.json`: `"/api/cron/drafts"` every 3 minutes
5. Wire Gmail label sync into classifier.ts:
   - After classification updates, call `applyZoeLabel` for each classified signal
   - Run label application in background (don't block classification)
   - Handle label creation on first run via `ensureZoeLabels`

**Acceptance Criteria:**
- Drafts appear in `draft_replies` table within 5 minutes of signal classification
- Each draft has valid to, subject, body
- Gmail labels appear in user's inbox within 5 minutes of classification
- Label colors match specification
- Cron handles errors gracefully (one failed draft doesn't block others)
- Daily cap of 20 drafts/user enforced

**Dependencies:** Sprint 1

---

### Epic SD-3: Post-Meeting Follow-ups & Time Finder

**Objective:** Follow-up drafts generated after meetings; time finder available in chat.

**Tasks:**

1. Create `lib/ai/prompts/generate-followup.ts` — prompt for post-meeting follow-up emails
2. Create `lib/drafts/generate-followup.ts`:
   - `generateMeetingFollowup(meeting, relatedSignals, userProfile)` — calls Sonnet 4.6
   - Returns `{ to, subject, body }` with attendees as recipients
3. Add follow-up generation to `/api/cron/drafts/route.ts`:
   - After draft replies, check for meetings that ended in last 15 minutes
   - Filter: only `decision_density` = 'high' or 'medium'
   - Filter: only meetings where user is organizer or contributor
   - Filter: no existing follow-up draft for this meeting
   - Generate and store with `draft_type: 'follow_up'`
4. Add `find_available_times` tool to `lib/ai/tools/chat-tools.ts`:
   - Import `findAvailableTimes` from calendar module
   - Wire as chat tool with schema
5. Write integration test for follow-up generation (mock Supabase + AI)

**Acceptance Criteria:**
- Follow-up drafts generated within 15 minutes of meeting end
- Follow-ups reference actual attendee names and meeting topic
- No follow-up for low-density or passive-attendance meetings
- `find_available_times` chat tool returns accurate slots
- Chat correctly renders time slot suggestions

**Dependencies:** Sprint 1, Sprint 2 (shares cron)

---

## Sprint 3: UI (3-4 days)

### Epic SD-4: Draft Review UI

**Objective:** Users can view, edit, send, and discard drafts from the Command Center.

**Tasks:**

1. Create `hooks/use-drafts.ts`:
   - `useDraftForActivity(activityId)` — fetches draft linked to an activity
   - `useUpdateDraft()` — mutation for editing draft body
   - `useSendDraft()` — mutation that POSTs to `/api/drafts/[id]/send`
   - `useDiscardDraft()` — mutation that POSTs to `/api/drafts/[id]/discard`
2. Create API routes:
   - `api/drafts/[id]/route.ts` — GET (fetch), PATCH (edit body)
   - `api/drafts/[id]/send/route.ts` — POST (send via Gmail)
   - `api/drafts/[id]/discard/route.ts` — POST (mark discarded)
3. Create `components/command/draft-review-panel.tsx`:
   - Sheet (slide-over) component
   - Shows: To, Subject (read-only), Body (editable textarea)
   - Buttons: Send, Discard, Close
   - Send requires confirmation dialog ("Send this email to {{to}}?")
   - Loading states for send action
4. Modify `components/command/activity-card.tsx`:
   - Add "Draft ready" indicator (small green badge/dot) when draft exists
   - Add "View Draft" button in actions row
   - Pass `onViewDraft: (activityId: string) => void` prop
5. Modify `app/(dashboard)/command/page.tsx`:
   - Add state for selected draft activity
   - Render `DraftReviewPanel` sheet
   - Wire `onViewDraft` handler
6. Update `components/command/activity-list.tsx` to pass through `onViewDraft`
7. Add "Writing Style" section to Settings page:
   - Textarea for `writing_style_notes`
   - Save to profiles table
   - Example placeholder: "Direct and concise. No fluff. Sign off with 'Best,'"

**Acceptance Criteria:**
- "Draft ready" badge visible on activity cards with drafts
- Click "View Draft" opens slide-over with draft content
- User can edit the body text inline
- Send button sends email and marks activity as completed
- Discard button removes draft and keeps activity open
- Writing style changes persist and affect future drafts

**Dependencies:** Sprint 2 (drafts must exist in DB)

---

## Sprint 4: Polish (2 days)

### Epic SD-5: Quality & Monitoring

**Objective:** Production hardening, cost controls, cleanup.

**Tasks:**

1. Add draft generation cost tracking:
   - Record `prompt_tokens` and `completion_tokens` in `draft_replies`
   - Add to `lib/monitoring/llm-costs.ts` tracking
2. Add draft quality metrics:
   - Track accept/edit/discard rates per user
   - Log to `daily_metrics` or new analytics table
3. Gmail label cleanup on disconnect:
   - When Google is disconnected, optionally remove Zoe/* labels from Gmail
   - Add to `disconnectGoogle()` in `google-auth.ts`
4. Rate limiting:
   - Enforce 20 drafts/day/user in cron
   - Add Redis counter: `drafts:${userId}:${date}` with 24h TTL
5. Error handling:
   - Draft generation failures: log, skip, continue to next
   - Gmail label API failures: log, don't block classification
   - Follow-up generation for meetings without context: use template with placeholders
6. Write tests:
   - Unit test for draft generation prompt construction
   - Unit test for Gmail label mapping logic
   - Integration test for draft API routes (mock Supabase)

**Acceptance Criteria:**
- Cost per user trackable and within $3.05 budget
- Draft rates visible in monitoring
- Label sync failures don't cascade
- Rate limits enforced
- All new code has test coverage

**Dependencies:** Sprint 3

---

## Dependency Graph

```
Sprint 1 (Foundation)
├── SD-1: Schema + core modules
│
Sprint 2 (Pipelines) <- depends on Sprint 1
├── SD-2: Draft generation + Gmail labels
├── SD-3: Follow-ups + time finder
│
Sprint 3 (UI) <- depends on Sprint 2
├── SD-4: Draft review panel + activity cards
│
Sprint 4 (Polish) <- depends on Sprint 3
└── SD-5: Monitoring + rate limits + tests
```

**Parallelization:** Within Sprint 2, SD-2 and SD-3 are mostly independent (they share the cron route but work on different data). Within Sprint 3, the settings writing style section is independent of the draft review panel.

---

## Files Created/Modified Summary

### New Files
| File | Purpose |
|------|---------|
| `supabase/migrations/00005_draft_replies.sql` | draft_replies table, profile + connection columns |
| `domain/drafts.ts` | DraftReply type |
| `lib/ai/prompts/generate-draft-reply.ts` | Draft reply prompt template |
| `lib/ai/prompts/generate-followup.ts` | Post-meeting follow-up prompt |
| `lib/ai/schemas/draft-reply.ts` | Zod schema for draft output |
| `lib/integrations/gmail-labels.ts` | Gmail label CRUD |
| `lib/calendar/find-available-times.ts` | Free slot calculator |
| `lib/drafts/generate-draft.ts` | Draft generation orchestrator |
| `lib/drafts/generate-followup.ts` | Follow-up generation orchestrator |
| `api/cron/drafts/route.ts` | Draft + follow-up generation cron |
| `api/drafts/[id]/route.ts` | Draft GET + PATCH |
| `api/drafts/[id]/send/route.ts` | Draft send endpoint |
| `api/drafts/[id]/discard/route.ts` | Draft discard endpoint |
| `hooks/use-drafts.ts` | React Query hooks for drafts |
| `components/command/draft-review-panel.tsx` | Draft review slide-over |

### Modified Files
| File | Change |
|------|--------|
| `lib/integrations/gmail.ts` | Add `getMessageBody()` |
| `lib/signals/classifier.ts` | Wire Gmail label sync after classification |
| `lib/ai/tools/chat-tools.ts` | Add `find_available_times` tool |
| `components/command/activity-card.tsx` | Add draft badge + View Draft button |
| `components/command/activity-list.tsx` | Pass through onViewDraft |
| `app/(dashboard)/command/page.tsx` | Wire draft panel state |
| `app/(dashboard)/settings/page.tsx` | Add writing style section |
| `vercel.json` | Add `/api/cron/drafts` schedule |
| `domain/signals.ts` or new `domain/drafts.ts` | DraftReply type |

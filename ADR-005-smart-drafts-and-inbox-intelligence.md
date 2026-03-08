# ADR-005: Smart Drafts & Inbox Intelligence

## Status: PROPOSED

## Context

Competitive analysis of Fyxer.ai revealed key feature gaps in Zoe's email handling. Fyxer's core value proposition is proactive email draft generation and inbox organization — features that Zoe's existing AI pipeline supports architecturally but doesn't yet deliver.

Zoe classifies signals and scores activities, but stops short of acting on them. The classification output (`requires_response`, `urgency_score`, `topic_cluster`) is used only for ranking. This ADR covers extending the pipeline to generate proactive outputs: draft replies, Gmail labels, and post-meeting follow-ups.

## Decision

### 1. Proactive Draft Generation via Pipeline Extension

**Approach:** Add a new pipeline step after activity extraction that generates draft replies for signals marked `requires_response: true`.

**Why not generate in real-time (on page load)?**
- Draft generation takes 3-5s per email (Sonnet 4.6)
- Users with 20+ emails needing replies would wait 60-100s
- Background cron generation means drafts are ready before the user even opens the app
- Matches the existing cron-based architecture (classify -> cluster -> score -> draft)

**Why Sonnet 4.6, not Haiku 4.5?**
- Drafts are user-facing text that gets sent to real people
- Quality gap between Haiku and Sonnet is significant for natural-sounding email
- $0.60/user/month additional cost is acceptable (stays within $3 budget)

**Alternative considered: Draft in browser (on-demand)**
- Pro: Only generates drafts user actually wants to see (saves cost)
- Con: 3-5s loading spinner every time user wants a draft
- Con: Breaks the "open app, everything is ready" value prop
- Verdict: Background generation is better UX. Add a daily cap (20 drafts/day) to control cost.

### 2. Gmail Label Sync via API

**Approach:** After signal classification, write Zoe's categories back to Gmail as nested labels (`Zoe/Respond Now`, `Zoe/FYI`, etc.).

**Why labels and not Gmail categories?**
- Gmail API supports custom labels with colors — categories are fixed (Primary, Social, etc.)
- Nested labels (`Zoe/...`) group under a single parent in the Gmail sidebar
- Labels are visible in both Gmail web and mobile apps

**Why not modify Gmail's Primary/Promotions/Updates tabs?**
- Those categories use Google's own ML model — overriding them would confuse users
- Additive labels alongside existing categorization is less disruptive

**Alternative considered: Only show in Zoe UI**
- Con: Users live in Gmail, not in Zoe. Making intelligence visible where they already are increases perceived value.
- Verdict: Labels create an ambient awareness of Zoe even when the user isn't in the app.

### 3. Post-Meeting Follow-ups Without Transcription

**Approach:** Generate follow-up email drafts using meeting metadata + related signals, not actual meeting audio/transcript.

**Why not add transcription now?**
- Transcription services (Recall.ai) cost ~$0.20/hr of audio
- At 3 meetings/day, that's $12/user/month — 80% of the subscription price
- Requires new infrastructure: bot management, audio processing, storage
- Meeting transcription is a standalone product (tl;dv, Otter, Fireflies) — hard to compete as a feature

**Why this approach works without transcription:**
- Most meetings have email/Slack threads about the same topic (signals exist)
- Meeting metadata (title, attendees, duration, decision density) provides structure
- The follow-up template ("Thanks for the discussion on X. Here are the action items we discussed: ...") is useful even with inferred content
- When meeting transcription is added later (Phase 5), it enhances this feature — doesn't replace it

**Trade-off accepted:**
- Follow-up quality is lower without transcription (~60% of Fyxer quality)
- But it's free (no per-meeting cost) and automatic
- Users can edit the draft to add actual discussion points

### 4. Available Time Finder as a Chat Tool

**Approach:** Pure database query against `calendar_events` + user's work hours. No LLM involved.

**Why not use an LLM for scheduling?**
- Calendar math is deterministic — LLMs add latency and cost without benefit
- Free/busy computation is well-defined: subtract busy intervals from work hours
- The LLM's role is understanding the natural language request (already handled by the chat model) — the tool execution is pure logic

### 5. Meeting Transcription Deferred to Phase 5

**Recommendation when built:** Recall.ai for multi-platform support (Zoom, Meet, Teams), offered as a premium add-on at $10/month extra.

**Phased transcription strategy (when built):**

1. **Phase 5a: Google Meet REST API (free, lowest effort)**
   - Fetch VTT transcripts after meetings end via REST API
   - Already have Google OAuth — natural extension
   - Limitation: Google Meet only, post-meeting only, requires Business Standard+
   - Run transcript through Claude for summarization + action items
   - Engineering: 2-3 days, Cost: $0 per meeting

2. **Phase 5b: Recall.ai (multi-platform, $0.50/hr)**
   - Bot joins Zoom, Teams, Google Meet, Webex — single API
   - Covers users who don't have Google Workspace Business Standard
   - Real-time transcription + speaker diarization
   - At 20 hrs/month of meetings: $10/user/month → premium add-on pricing needed
   - User-selective: only transcribe meetings marked as important

**Why Recall.ai over building in-house?**
- Meeting bot infrastructure is complex (join protocols differ per platform)
- Recall.ai handles bot lifecycle, audio capture, speaker diarization
- Focus engineering effort on what makes Zoe unique (priority engine, scoring)

**Why not AssemblyAI/Deepgram directly?**
- They are transcription-only (you provide audio) — still need audio capture
- Only useful if building own recording pipeline, which Recall.ai eliminates

## Consequences

### New Infrastructure
- `draft_replies` table with RLS
- `lib/integrations/gmail-labels.ts` module
- `lib/ai/prompts/generate-draft-reply.ts` prompt template
- `lib/calendar/find-available-times.ts` utility
- New cron job `/api/cron/drafts` (every 3 minutes)
- New API routes for draft CRUD and send

### Cost Impact
- Additional ~$0.75/user/month in LLM costs
- Total LLM cost: ~$3.05/user/month (slightly above $3 target — mitigate with daily draft cap)

### Schema Changes
- New `draft_replies` table
- New column on `profiles`: `writing_style_notes`
- New column on `integration_connections`: `metadata` JSONB
- New columns on `draft_replies`: `draft_type`, `meeting_id`

### Risk Mitigation
- Daily draft cap (20/user) prevents cost runaway
- Gmail label sync failures are non-critical (signal classification still works in Zoe UI)
- Follow-up quality without transcription is explicitly positioned as "good first draft" — user editing expected

## Timeline

Features 1-4: 2 weeks (4 sprints of 3-4 days each)
Feature 5 (transcription): Phase 5 (post-MVP, separate ADR)

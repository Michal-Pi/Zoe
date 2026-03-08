# Zoe — Epic Breakdown & Phase Plan

## Overview

The build is organized into 6 phases. Each phase is a shippable increment. Phases 1–3 deliver the MVP. Phases 4–6 are post-MVP enhancements.

**Estimated MVP timeline:** 6–8 weeks of active development.

---

## Phase 0: Foundation (Week 1)

### Epic 0.1: Project Scaffold

**Objective:** Working Next.js app deployed to Vercel with Supabase connected.

**Tasks:**

1. Initialize Next.js 15 project with App Router, TypeScript, Tailwind CSS
2. Install and configure shadcn/ui (init + Tier 1 components)
3. Set up Supabase project (database, auth, storage)
4. Configure environment variables (.env.example + Vercel env vars)
5. Set up Tailwind config with Zoe design tokens (colors, fonts, spacing)
6. Create app shell layout (sidebar nav, top bar, main content area)
7. Deploy to Vercel (auto-deploy from `main` branch)
8. Set up ESLint, Prettier, TypeScript strict mode
9. Write CLAUDE.md project constitution
10. Configure .mcp.json (GitHub, Supabase, Context7)

**Acceptance Criteria:**

- `pnpm dev` starts and renders app shell
- Vercel preview deployment works on PR
- Supabase connection confirmed (can query from API route)
- shadcn/ui Button renders with Zoe design tokens
- TypeScript strict mode passes with zero errors

### Epic 0.2: Database Schema

**Objective:** All Supabase tables created with RLS policies.

**Tasks:**

1. Write SQL migration for profiles, strategic_priorities
2. Write SQL migration for customers, subscriptions
3. Write SQL migration for integration_connections, integration_tokens, slack_channel_configs
4. Write SQL migration for signals
5. Write SQL migration for work_objects, work_object_signals, activities
6. Write SQL migration for calendar_events
7. Write SQL migration for chat_conversations, chat_messages
8. Write SQL migration for daily_metrics
9. Apply RLS policies to all tables
10. Write seed data for development

**Acceptance Criteria:**

- All tables exist with correct columns and types
- RLS policies prevent cross-user data access
- integration_tokens has no client-side read access
- Seed data loads successfully
- Supabase dashboard shows correct schema

### Epic 0.3: Authentication

**Objective:** Users can sign up, sign in, and access protected routes.

**Tasks:**

1. Configure Supabase Auth (Google OAuth provider + email/password)
2. Create Supabase client utilities (browser client + server client)
3. Build sign-up page with Google OAuth + email option
4. Build sign-in page
5. Add Next.js middleware for auth-protected routes
6. Create auth context/hook for client-side auth state
7. Build user profile creation (on first sign-in, create profile row)
8. Add sign-out functionality

**Acceptance Criteria:**

- Google OAuth sign-in works end-to-end
- Email/password sign-up + sign-in works
- Unauthenticated users redirected to /login
- Authenticated users can access /dashboard
- Profile row created automatically on first sign-in
- Sign-out clears session and redirects

---

## Phase 1: Impact Dashboard (Week 2)

### Epic 1.1: Dashboard Layout & Static UI

**Objective:** Dashboard page with all 3 sections rendering mock data.

**Tasks:**

1. Create /dashboard page with 3-section layout
2. Build Reality Brief section (metric cards: execution time, meetings, threads, loops)
3. Build Behavioral Snapshot section (reactive %, deep work blocks, meeting outcomes)
4. Build Intervention Suggestions section (actionable cards)
5. Add Skeleton loading states for all sections
6. Style with design tokens (metric cards, section headers, spacing)

**Acceptance Criteria:**

- Dashboard renders 3 distinct sections
- Metric cards display large numbers with labels and trend indicators
- Loading skeletons appear before data loads
- Responsive: works on desktop (3-col metrics) and mobile (2-col)

### Epic 1.2: Calendar Data Integration

**Objective:** Google Calendar connected and events synced to Supabase.

**Tasks:**

1. Build Google OAuth connection flow (connect button → OAuth redirect → callback)
2. Port Google Calendar API client from LifeOS_2 (adapt for Supabase token storage)
3. Create /api/integrations/google/connect and /callback routes
4. Build initial calendar sync (fetch events for current + next 7 days)
5. Store calendar events in Supabase calendar_events table
6. Create Vercel Cron job for periodic sync (/api/cron/sync, every 5 min)
7. Calculate available execution time from calendar events + work hours
8. Calculate meeting count and total meeting minutes

**Acceptance Criteria:**

- Google Calendar connects via OAuth without errors
- Events appear in calendar_events table within 60s of connection
- Execution time calculation matches manual count
- Cron job runs and updates events every 5 minutes
- Token refresh works automatically when access token expires

### Epic 1.3: Dashboard with Live Data

**Objective:** Dashboard shows real data from connected Google Calendar.

**Tasks:**

1. Create React Query hooks for fetching dashboard metrics
2. Wire Reality Brief to live calendar data (execution time, meeting count)
3. Add placeholder values for Slack/email metrics (show "Connect Slack" CTA)
4. Compute and display intervention suggestions based on available data
5. Add Supabase Realtime subscription for metric updates

**Acceptance Criteria:**

- Dashboard shows real execution time based on today's calendar
- Meeting count matches Google Calendar
- Intervention suggestions reference actual meetings by name
- Data refreshes when calendar changes (via Realtime or React Query refetch)

---

## Phase 2: Command Center (Weeks 3–4)

### Epic 2.1: Signal Ingestion — Gmail

**Objective:** Gmail connected and messages synced as signals.

**Tasks:**

1. Add Gmail scopes to Google OAuth connection (modify existing flow)
2. Port Gmail API client from LifeOS_2 (adapt for Supabase)
3. Build initial Gmail sync (fetch last 7 days of inbox)
4. Normalize Gmail messages to signals table schema
5. Set up Gmail push notifications (webhook → /api/signals/gmail)
6. Handle deduplication (upsert by source + external_id)
7. Add Gmail sync to periodic cron job

**Acceptance Criteria:**

- Gmail messages appear in signals table within 60s of connection
- Push notifications deliver new messages within 30s
- Thread grouping works (thread_id links related messages)
- Sender info, snippet, labels populated correctly
- Deduplication prevents duplicate rows

### Epic 2.2: Signal Ingestion — Slack

**Objective:** Slack connected and messages synced as signals.

**Tasks:**

1. Build Slack OAuth connection flow (/api/integrations/slack/connect + /callback)
2. Create Slack Events API webhook handler (/api/signals/slack)
3. Build channel configuration UI (select which channels to monitor)
4. Sync monitored channels' recent messages (last 7 days)
5. Normalize Slack messages to signals table schema
6. Handle thread grouping and participant extraction
7. Track thread velocity (message count in thread over time)

**Acceptance Criteria:**

- Slack connects via OAuth and shows channel list
- User can select channels to monitor
- Messages from monitored channels appear in signals table
- DMs and mentions always captured regardless of channel config
- Thread velocity tracked for scoring engine

### Epic 2.3: AI Signal Classification

**Objective:** All signals classified by AI for urgency, topic, and ownership.

**Tasks:**

1. Set up Anthropic API client with Vercel AI SDK
2. Create classification prompt template (urgency, topic, ownership, requires_response)
3. Build batch classification pipeline (process unclassified signals in groups of 10–20)
4. Create /api/cron/classify cron job (runs every 2 minutes)
5. Define Zod schemas for classification output
6. Store classification results in signals table (update AI-enriched fields)
7. Add Upstash Redis caching for identical signal content

**Acceptance Criteria:**

- Unclassified signals processed within 5 minutes of ingestion
- Classification output matches Zod schema (no parse failures)
- Urgency scores distribute reasonably (not all 50s, not all 100s)
- Cache hit rate >30% for repeated thread classifications
- Cost per classification batch <$0.01

### Epic 2.4: Work Object Clustering & Activity Extraction

**Objective:** Signals grouped into Work Objects; Activities extracted and scored.

**Tasks:**

1. Build clustering logic (group signals by thread_id, topic, meeting reference)
2. Create/update work_objects from signal clusters
3. Build activity extraction prompt (Sonnet — Work Object → atomic Activities)
4. Create Zod schema for activity extraction output
5. Build scoring engine (weighted factors → 0–100 score with rationale)
6. Integrate with user's strategic priorities for alignment scoring
7. Handle large tasks (auto-split >90 minutes into increments)
8. Create /api/scoring/recalculate endpoint
9. Trigger recalculation on: new signal, task completion, time change

**Acceptance Criteria:**

- Related signals cluster into same Work Object
- Activities are atomic, verb-based, with time estimates
- Scores produce meaningful differentiation (not all similar)
- Rationale bullets are specific (reference actual context, not generic)
- Tasks >90min auto-split with parent-child relationship
- Recalculation completes within 10s

### Epic 2.5: Command Center UI

**Objective:** Full Command Center page with dominant action, ranked list, and task lifecycle.

**Tasks:**

1. Create /command page layout
2. Build Dominant Action card (largest card, score badge, rationale, action buttons)
3. Build ranked activity list (compact cards, scrollable)
4. Build batch group cards (expandable, show count + total time)
5. Add horizon tags (NOW, SOON, STRATEGIC) as badges
6. Implement task lifecycle buttons (Start, Complete, Snooze, Pin, Not Mine)
7. Add "Priorities updated" toast notification on score changes
8. Wire to Supabase Realtime for live updates
9. Add React Query hooks for activity data

**Acceptance Criteria:**

- Dominant action always shows highest-scored pending activity
- List updates in real-time when scores change
- Start/Complete/Snooze actions update database and rerank list
- Snooze shows date/time picker
- Pin overrides ranking (pinned items appear at top)
- Batch groups expand to show individual items
- Mobile: cards stack, actions accessible via swipe or menu

---

## Phase 3: Calendar Intelligence + Chat (Weeks 5–6)

### Epic 3.1: Calendar Intelligence UI

**Objective:** Calendar page showing today's meetings with AI classification.

**Tasks:**

1. Create /calendar page layout
2. Build meeting card component (time, duration, role, decision density, prep status)
3. Run meeting classification on synced calendar events (AI pipeline)
4. Display efficiency risk flags (no prep, back-to-back, recurring stale)
5. Show prep suggestions for high-density meetings
6. Calculate and display "has_prep_block" status
7. Add day navigation (today, tomorrow, this week)

**Acceptance Criteria:**

- Today's meetings display with correct times and durations
- Role detection works (Organizer vs Participant)
- Decision density labels appear on meeting cards
- Risk flags visible for problematic meetings
- Prep status shows whether a prep block exists before the meeting

### Epic 3.2: Zoe Chat

**Objective:** Context-aware chat interface for executing actions.

**Tasks:**

1. Create /chat page with message list + input
2. Build chat API route with Vercel AI SDK streaming
3. Implement context assembly (gather relevant signals, meetings, priorities for each message)
4. Define tool schemas for: draft_email, draft_slack_message, modify_calendar_event, create_time_block, generate_meeting_brief, search_signals
5. Build tool execution handlers (each tool calls respective integration API)
6. Build confirmation UI for external actions (send email, modify calendar)
7. Add "Ask Zoe" button on activity cards → opens chat with pre-loaded context
8. Store chat history in chat_conversations + chat_messages tables
9. Implement conversation list in sidebar

**Acceptance Criteria:**

- Chat responds with context-specific answers (references user's actual meetings/threads)
- Streaming responses display incrementally
- Tool calls show structured output (draft preview, calendar change preview)
- External actions require confirmation before executing
- "Ask Zoe" from activity card loads relevant context
- Chat history persists across sessions

### Epic 3.3: Onboarding Flow

**Objective:** Guided onboarding that connects integrations and sets priorities.

**Tasks:**

1. Build multi-step onboarding page (/onboarding)
2. Step 1: Welcome + explain value proposition
3. Step 2: Connect Google Calendar + Gmail (OAuth flow)
4. Step 3: Connect Slack (OAuth flow + channel selection)
5. Step 4: Set 3 strategic priorities (text inputs)
6. Step 5: Configure work hours and timezone
7. Step 6: Success screen → redirect to dashboard
8. Track onboarding_completed in profiles table
9. Skip completed steps on re-visit

**Acceptance Criteria:**

- New users land on onboarding after first sign-in
- Each integration shows connection status (connected/not connected)
- Users can skip optional steps (Slack) and complete later
- Strategic priorities saved and used by scoring engine
- Onboarding completion rate trackable
- Users who completed onboarding bypass it on subsequent logins

### Epic 3.4: Billing Integration

**Objective:** Stripe subscription with 14-day trial.

**Tasks:**

1. Set up Stripe products (Individual plan: $15/month, $144/year)
2. Create Stripe customer on user sign-up (via webhook or API route)
3. Build /api/billing/checkout (create Stripe Checkout Session)
4. Build /api/billing/portal (create Customer Portal Session)
5. Build /api/billing/webhook (handle subscription events)
6. Create subscription status check middleware (trial active OR subscription active)
7. Build paywall UI (shown when trial expires and no active subscription)
8. Build billing settings page (current plan, next billing date, manage subscription)
9. Handle edge cases: payment failure, subscription canceled, resubscribe

**Acceptance Criteria:**

- New users start with 14-day trial automatically
- Trial countdown visible in settings
- Checkout flow completes and activates subscription
- Webhook correctly updates subscription status in Supabase
- Paywall prevents access to dashboard after trial expires without payment
- Customer Portal allows plan changes and cancellation

---

## Phase 4: Polish & Launch Prep (Week 7)

### Epic 4.1: Marketing Site

- Landing page with value proposition, features, pricing
- SSR-rendered (Next.js server components)
- Responsive design

### Epic 4.2: Testing & Quality

- Unit tests for scoring engine
- Integration tests for API routes
- E2E tests for critical flows (sign-up → connect → dashboard)
- Performance audit (Lighthouse, Core Web Vitals)

### Epic 4.3: Monitoring & Observability

- Sentry error tracking
- Vercel Analytics
- LLM cost monitoring dashboard
- User activity tracking (PostHog or Mixpanel)

---

## Phase 4.5: Smart Drafts & Inbox Intelligence (Weeks 7–8)

See `PRD-SMART-DRAFTS.md`, `ADR-005-smart-drafts-and-inbox-intelligence.md`, and `EPIC-SMART-DRAFTS.md` for full details.

### Epic SD-1: Foundation

- Database migration: draft_replies table, writing_style_notes, metadata JSONB
- Gmail labels module, draft generation prompt, available time finder utility
- Unit tests for time finder and schemas

### Epic SD-2: Draft Generation Pipeline

- Proactive email draft generation cron (Sonnet 4.6, 20/day cap)
- Gmail label sync after classification (Zoe/* color-coded labels)
- Full email body fetching for draft context

### Epic SD-3: Follow-ups & Time Finder

- Post-meeting follow-up draft generation (high/medium density meetings)
- `find_available_times` chat tool (pure calendar math, no LLM)

### Epic SD-4: Draft Review UI

- "Draft ready" badge on activity cards
- Slide-over draft review panel (edit, send, discard)
- Writing style preferences in Settings

### Epic SD-5: Polish & Monitoring

- Cost tracking, rate limiting, error handling
- Gmail label cleanup on disconnect
- Draft quality metrics (accept/edit/discard rates)

---

## Phase 5: Post-MVP Enhancements (Weeks 9–12)

### Epic 5.1: Behavioral Snapshot

- Weekly trend analysis (reactive vs proactive ratio)
- Deep work block tracking
- Meeting outcome documentation
- Behavioral improvement suggestions

### Epic 5.2: Dark Mode (DONE)

- Toggle in settings — already implemented
- Design tokens support it
- Preference persisted in profiles table

### Epic 5.3: Email Sending from Chat (DONE)

- Compose and send emails via Zoe Chat — already implemented
- Draft review + confirmation flow via chat tools
- send_email tool with Gmail API integration

### Epic 5.4: Slack Message Sending (DONE)

- Compose and send Slack messages via Zoe Chat — already implemented
- Channel/DM selection
- send_slack_message tool with confirmation

### Epic 5.5: Meeting Transcription & Notes (NEW)

- Integration with Recall.ai for multi-platform meeting recording
- Automatic transcription and AI-generated summaries
- Action item extraction from transcripts
- Enhanced post-meeting follow-ups using actual discussion content
- Premium add-on ($10/month) due to per-meeting costs
- See ADR-005 for decision rationale

---

## Phase 6: Growth Features (Weeks 12+)

### Epic 6.1: Weekly Review

- End-of-week summary email
- Productivity trends visualization
- Goal progress tracking

### Epic 6.2: LinkedIn Integration

- Connect LinkedIn for signal ingestion
- Message sync

### Epic 6.3: Mobile Optimization

- PWA support (installable on mobile)
- Bottom tab navigation
- Push notifications

### Epic 6.4: Team Plan

- Multi-user accounts
- Shared priorities
- Team analytics

---

## Dependency Graph

```
Phase 0 (Foundation)
├── 0.1 Scaffold
├── 0.2 Database Schema ← depends on 0.1
└── 0.3 Authentication ← depends on 0.1, 0.2

Phase 1 (Dashboard) ← depends on Phase 0
├── 1.1 Dashboard Static UI
├── 1.2 Calendar Integration ← depends on 0.3
└── 1.3 Dashboard Live Data ← depends on 1.1, 1.2

Phase 2 (Command Center) ← depends on Phase 1
├── 2.1 Gmail Integration ← depends on 1.2 (Google OAuth exists)
├── 2.2 Slack Integration ← independent of 2.1
├── 2.3 AI Classification ← depends on 2.1 OR 2.2 (needs signals)
├── 2.4 Work Objects + Scoring ← depends on 2.3
└── 2.5 Command Center UI ← depends on 2.4

Phase 3 (Calendar + Chat) ← depends on Phase 2
├── 3.1 Calendar Intelligence ← depends on 1.2
├── 3.2 Zoe Chat ← depends on 2.4 (needs activities for context)
├── 3.3 Onboarding ← depends on 0.3, 1.2, 2.2
└── 3.4 Billing ← depends on 0.3

Phase 4 (Polish) ← depends on Phase 3
Phase 4.5 (Smart Drafts) ← depends on Phase 2 (classification pipeline)
├── SD-1: Foundation
├── SD-2: Pipelines ← depends on SD-1
├── SD-3: Follow-ups + Time Finder ← depends on SD-1
├── SD-4: UI ← depends on SD-2, SD-3
└── SD-5: Polish ← depends on SD-4
Phase 5 (Post-MVP) ← depends on Phase 4
Phase 6 (Growth) ← depends on Phase 5
```

## Parallelization Opportunities

Within each phase, several epics can run concurrently:

- **Phase 2:** Epic 2.1 (Gmail) and 2.2 (Slack) are independent — can run in parallel
- **Phase 3:** Epic 3.1 (Calendar Intel) and 3.4 (Billing) are independent
- **Phase 3:** Epic 3.3 (Onboarding) can start once integration flows from Phase 2 are done

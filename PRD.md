# Zoe — Product Requirements Document

## Product Vision

Zoe is your unified work brain — an agentic personal assistant and chief of staff for $15/month. Zoe connects to Slack, email, and calendar to continuously understand what's happening across your work and private life, then surfaces the right action at the right time so you operate with clarity instead of reacting to notifications.

**Tagline:** Stop reacting. Start operating.

**Goal:** Reclaim 10–15 hours per week for every user.

---

## Target User

High-autonomy professionals — marketing managers, product managers, founders, consultants, team leads — who:

- Run on Slack + Gmail + Google Calendar daily
- Make 20+ decisions per day
- Feel overloaded by meetings, open loops, and context-switching
- Currently use 3–5 tools to manage their work (none of which talk to each other)
- Have tried GTD, Todoist, Notion — and abandoned them within weeks

**Anti-persona:** Teams looking for project management (Linear, Jira). Enterprise buyers needing SSO/compliance. People who don't use Slack or Google Workspace.

---

## Problem Statement

Knowledge workers lose 10–15 hours/week to:

1. **Reactive communication** — responding to Slack/email as it arrives instead of batching
2. **Meeting overload** — back-to-back meetings with no prep, no outcomes documented
3. **Open loops** — threads that need follow-up but fall through the cracks
4. **Priority blindness** — no system tells you what the _highest-impact_ thing to do right now
5. **Manual task management** — maintaining to-do lists is itself a time sink

Existing tools (Todoist, Notion, Reclaim.ai) solve fragments. None ingest your actual communication signals and dynamically reprioritize in real-time.

---

## MVP Scope (v1.0)

The MVP focuses on one core outcome: **ensuring the user always knows their next highest-priority action**.

### In Scope

#### 1. Impact Dashboard (Today's Reality Brief)

- Show real execution time available today (calendar math)
- Count active Slack threads, unread emails, open loops
- Surface behavioral snapshot (reactive vs. proactive ratio)
- Provide 2–3 intervention suggestions

**Acceptance Criteria:**

- Dashboard loads in <2s with data from all connected sources
- Execution time calculation accounts for meetings, travel buffers, and blocked time
- Behavioral metrics update every 15 minutes while user is active
- Intervention suggestions are contextual (not generic tips)

#### 2. Command Center (Priority Engine)

- Ingest signals from Gmail, Google Calendar, Slack
- Cluster signals into Work Objects (e.g., "Roadmap Sync", "Legal Approval")
- Extract atomic, time-estimated Activities from Work Objects
- Score activities 0–100 based on urgency, strategic alignment, blocking impact, consequence of delay
- Display dominant action card + ranked list of top activities
- Support task lifecycle: Start, Complete, Snooze, Pin, Mark Not Mine

**Acceptance Criteria:**

- Activities generate within 30s of new signal ingestion
- Scoring recalculates on: new message, meeting approaching, task completion, time change
- Dominant action updates without page reload (real-time)
- Score includes 1–3 rationale bullets explaining why
- Activities grouped into batches where appropriate (e.g., "Slack Batch — Growth Channel")
- No activity exceeds 90-minute estimate; larger tasks auto-split

#### 3. Calendar Intelligence

- Display today's meetings with role, decision density, prep status
- Classify meetings: decision density (high/medium/low), ownership load, efficiency risk
- Flag meetings with no prep time, back-to-back scheduling, recurring without change
- Allow calendar actions via Zoe Chat (move, shorten, block time, cancel)

**Acceptance Criteria:**

- Meeting cards show role (Organizer/Contributor/Participant) accurately
- Decision density classification matches at least 80% of user expectations after 1 week
- Prep time warnings appear 1h+ before meetings with no blocked prep
- Calendar modifications require explicit user confirmation before executing

#### 4. Zoe Chat (Action Layer)

- Context-aware chat grounded in user's signals (threads, meetings, priorities)
- Action-first responses: draft replies, generate meeting briefs, propose calendar changes
- External actions (send message, reschedule meeting) require explicit confirmation

**Acceptance Criteria:**

- Chat responses reference specific threads/meetings by name
- Draft quality rated "usable with minor edits" by 70%+ of test users
- All external-facing actions show confirmation dialog before executing
- Chat response time <5s for text generation, <10s for actions requiring API calls

#### 5. Integrations (Signal Sources)

- **Google Calendar:** Bidirectional sync (read events, write blocks/changes)
- **Gmail:** Read inbox, send/reply (OAuth)
- **Slack:** Read channels, DMs, threads (OAuth)

**Acceptance Criteria:**

- OAuth flows complete in <30s with clear error messaging
- Calendar sync latency <5 minutes for new/changed events
- Gmail fetches last 7 days on initial connect, then real-time via push notifications
- Slack monitors configured channels + all DMs; processes new messages within 60s

#### 6. Authentication & Onboarding

- Email/password + Google OAuth sign-up
- Guided onboarding: connect integrations, set 3 strategic priorities, configure work hours
- Free 14-day trial, then $15/month via Stripe

**Acceptance Criteria:**

- Sign-up to first dashboard view <3 minutes
- Onboarding completion rate >70% (all integrations connected)
- Stripe subscription creates successfully; webhooks handle payment failures gracefully

### Out of Scope (v1.0)

- LinkedIn, Telegram, WhatsApp integrations (future)
- Slack message _sending_ (read-only in MVP)
- Team/multi-user features
- Mobile app (web-first, responsive)
- Habit tracking, workout logging, notes (LifeOS features not in Zoe MVP)
- Custom AI agent/workflow builder
- Deep research workflows
- Contact CRM features beyond what's needed for meeting briefings
- Self-hosted option

---

## Non-Functional Requirements

### Performance

- Dashboard initial load: <2s (P95)
- Command Center update after new signal: <5s
- Chat response generation: <5s for text, <10s for actions
- API response times: <500ms for reads, <2s for writes

### Security

- OWASP Top 10:2025 compliance
- All data encrypted at rest (AES-256) and in transit (TLS 1.3)
- OAuth tokens stored server-side, never exposed to client
- Row-Level Security on all user data (Supabase RLS)
- No user data shared across accounts
- SOC 2 compliance roadmap (not required for MVP)

### Accessibility

- WCAG 2.2 Level AA compliance
- Keyboard navigation for all core workflows
- Screen reader support for dashboard and command center
- Color contrast ratios meet AA standards (4.5:1 for text)

### Reliability

- 99.5% uptime target
- Graceful degradation when integrations are temporarily unavailable
- Offline-capable dashboard (show cached data with staleness indicator)

### Scalability

- Architecture supports 10,000 concurrent users
- Signal processing pipeline handles 1M events/day
- Database designed for horizontal scaling

---

## Success Metrics

| Metric                             | Target (3 months post-launch) |
| ---------------------------------- | ----------------------------- |
| Weekly active users                | 500                           |
| Onboarding completion rate         | >70%                          |
| Daily dashboard visits             | >60% of WAU                   |
| Tasks completed via Command Center | >5/user/day                   |
| Trial-to-paid conversion           | >15%                          |
| Monthly churn                      | <8%                           |
| NPS                                | >40                           |
| Avg. time saved (self-reported)    | >5 hours/week                 |

---

## Core User Flows

### Flow 1: Morning Check-in

1. User opens Zoe → sees Impact Dashboard
2. Scans Reality Brief (execution time, meeting load, open loops)
3. Reviews behavioral snapshot
4. Reads intervention suggestions
5. Taps "Start" on dominant action in Command Center

### Flow 2: Execute Top Priority

1. Command Center shows dominant action: "Prepare for 3pm Roadmap Sync"
2. User taps "Generate Brief" → Zoe Chat opens with context
3. Zoe drafts meeting brief from Slack threads + email context
4. User reviews, edits, saves
5. User marks activity as Complete → Command Center reprioritizes

### Flow 3: Triage Incoming Signals

1. New Slack mention triggers priority recalculation
2. If score rises above threshold, subtle "Priorities updated" notification
3. User reviews updated ranking
4. Snoozes non-urgent items, starts urgent ones

### Flow 4: Calendar Optimization

1. User views Calendar Intelligence → sees back-to-back meetings flagged
2. Opens Zoe Chat: "Move the 2pm standup to tomorrow morning"
3. Zoe shows proposed change + affected participants
4. User confirms → calendar updates

---

## Revenue Model

- **Free trial:** 14 days, full features
- **Individual plan:** $15/month (annual: $144/year — $12/month)
- **Future:** Team plan ($25/user/month) with shared priorities and team analytics

Payment via Stripe. No free tier after trial (reduces support burden, signals value).

---

## Technical Constraints

- Must reuse significant portions of the LifeOS_2 codebase (calendar sync, email integration, AI agent infrastructure, contact resolution)
- Prefer Supabase + Vercel over Firebase where feasible (see ADR-001)
- React + TypeScript frontend (non-negotiable for code reuse)
- Must support Google Workspace as primary integration target
- LLM costs per user must stay under $3/month for sustainable unit economics at $15/month pricing

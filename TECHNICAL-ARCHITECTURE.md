# Zoe — Technical Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
│  Next.js App (Vercel Edge)  ←→  Supabase Realtime (WS)     │
└──────────────┬──────────────────────────────────────────────┘
               │ HTTPS / WSS
┌──────────────▼──────────────────────────────────────────────┐
│                    VERCEL PLATFORM                            │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Next.js App  │  │  API Routes  │  │  Cron Jobs   │      │
│  │  (SSR + SPA)  │  │  /api/*      │  │  (scheduled)  │      │
│  └──────────────┘  └──────┬───────┘  └──────┬───────┘      │
└──────────────────────────┬───────────────────┘───────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    SERVICE LAYER                              │
│                                                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐ │
│  │  Signal     │ │  Scoring   │ │  Calendar  │ │  Chat    │ │
│  │  Ingestion  │ │  Engine    │ │  Intel     │ │  Engine  │ │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └────┬─────┘ │
│        │              │              │             │         │
│  ┌─────▼──────────────▼──────────────▼─────────────▼──────┐ │
│  │              AI / LLM Layer (Vercel AI SDK)             │ │
│  │  Anthropic Haiku 4.5  |  Anthropic Sonnet 4.6          │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    DATA LAYER                                 │
│                                                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐ │
│  │  Supabase  │ │  Supabase  │ │  Upstash   │ │  Stripe  │ │
│  │  PostgreSQL│ │  Auth      │ │  Redis     │ │  Billing │ │
│  │  + RLS     │ │  + OAuth   │ │  (cache)   │ │          │ │
│  └────────────┘ └────────────┘ └────────────┘ └──────────┘ │
└─────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                 EXTERNAL INTEGRATIONS                         │
│                                                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│  │  Google    │ │  Gmail     │ │  Slack     │              │
│  │  Calendar  │ │  API       │ │  API       │              │
│  │  API       │ │            │ │            │              │
│  └────────────┘ └────────────┘ └────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
zoe/
├── .claude/                    # Claude Code config
│   └── rules/                  # Path-scoped rules
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Auth pages (login, signup, onboarding)
│   │   ├── (dashboard)/        # Protected app pages
│   │   │   ├── page.tsx        # Impact Dashboard (home)
│   │   │   ├── command/        # Command Center
│   │   │   ├── calendar/       # Calendar Intelligence
│   │   │   └── chat/           # Zoe Chat
│   │   ├── (marketing)/        # Public pages (landing, pricing)
│   │   ├── api/                # API routes
│   │   │   ├── signals/        # Signal ingestion endpoints
│   │   │   ├── scoring/        # Priority scoring endpoints
│   │   │   ├── calendar/       # Calendar actions
│   │   │   ├── chat/           # Chat completions
│   │   │   ├── integrations/   # OAuth + webhook handlers
│   │   │   ├── billing/        # Stripe webhooks
│   │   │   └── cron/           # Scheduled jobs
│   │   ├── layout.tsx          # Root layout
│   │   └── globals.css         # Global styles + tokens
│   ├── components/
│   │   ├── ui/                 # shadcn/ui base components
│   │   ├── dashboard/          # Impact Dashboard components
│   │   ├── command/            # Command Center components
│   │   ├── calendar/           # Calendar Intelligence components
│   │   ├── chat/               # Zoe Chat components
│   │   └── shared/             # Shared components (nav, sidebar, etc.)
│   ├── lib/
│   │   ├── supabase/           # Supabase client + server clients
│   │   ├── ai/                 # LLM service layer
│   │   │   ├── providers.ts    # Model configuration
│   │   │   ├── prompts/        # Prompt templates
│   │   │   └── schemas/        # Zod schemas for structured output
│   │   ├── scoring/            # Scoring engine
│   │   ├── signals/            # Signal processing
│   │   └── integrations/       # Google, Gmail, Slack clients
│   ├── domain/                 # Pure domain types (ported from LifeOS_2)
│   │   ├── signals.ts          # Signal, WorkObject, Activity types
│   │   ├── scoring.ts          # Score, ScoringFactor types
│   │   ├── calendar.ts         # CalendarEvent, Meeting types
│   │   └── chat.ts             # Message, Conversation types
│   ├── hooks/                  # React hooks
│   └── utils/                  # Utility functions
├── supabase/
│   ├── migrations/             # SQL migrations
│   ├── seed.sql                # Seed data
│   └── config.toml             # Supabase local config
├── public/                     # Static assets
├── tests/                      # Test files
├── docs/                       # Specs, ADRs (this folder)
├── .env.example                # Environment variables template
├── CLAUDE.md                   # Project constitution
├── next.config.ts              # Next.js config
├── tailwind.config.ts          # Tailwind config
├── tsconfig.json               # TypeScript config
└── package.json                # Dependencies
```

## Core Services

### 1. Signal Ingestion Pipeline

**Purpose:** Continuously pull signals from Gmail, Slack, and Google Calendar into a unified signals table.

```
[Gmail API] ──webhook──→ /api/signals/gmail   ──→ signals table
[Slack API] ──event────→ /api/signals/slack    ──→ signals table
[GCal API]  ──webhook──→ /api/signals/calendar ──→ signals table
[Cron]      ──poll─────→ /api/cron/sync        ──→ signals table
```

**Design:**

- Webhooks for real-time (Gmail push notifications, Slack Events API, Google Calendar push)
- Cron polling as fallback (every 5 minutes via Vercel Cron)
- All signals normalized to a common schema before storage
- Deduplication by source + external_id

### 2. Scoring Engine

**Purpose:** Score activities 0–100 based on multiple factors and maintain a ranked priority list.

**Flow:**

1. New signals arrive → trigger scoring recalculation
2. AI classifies signal (urgency, topic, ownership) — Haiku, batched
3. Signals clustered into Work Objects (by thread, topic, meeting)
4. Activities extracted from Work Objects — Sonnet
5. Each activity scored using weighted factors
6. Scores stored; client receives update via Supabase Realtime

**Scoring Factors:**

- Urgency (deadline proximity, meeting time) — 25%
- Strategic alignment (user's 3 priorities) — 20%
- Blocking impact (others waiting on user) — 20%
- Consequence of delay (escalation signals) — 15%
- Context fit (deep work window vs reactive window) — 10%
- Thread velocity (how fast a thread is moving) — 10%

**Stability:** Minor score shifts (<5 points) do not reshuffle ranking. Prevents UI jitter.

### 3. Calendar Intelligence Service

**Purpose:** Analyze meetings for decision density, prep status, and efficiency risk.

**Classification Model:**

- Parse meeting metadata (title, description, participants, organizer, duration, recurrence)
- LLM classifies decision density and ownership load — Haiku
- Detect efficiency risks (back-to-back, no prep, large group + no agenda)
- Generate prep suggestions for high-density meetings

### 4. Chat Engine

**Purpose:** Context-aware chat for executing actions.

**Flow:**

1. User sends message or clicks "Ask Zoe" on an activity
2. Context assembled: related signals, meetings, priorities, recent messages
3. LLM generates response with optional tool calls — Sonnet
4. Tool calls execute actions (draft email, modify calendar, etc.)
5. Actions requiring external side-effects show confirmation UI
6. User confirms → action executes

**Tools Available to Chat:**

- `draft_email(to, subject, body)` — generates email draft
- `draft_slack_message(channel, message)` — generates Slack message
- `modify_calendar_event(event_id, changes)` — proposes calendar change
- `create_time_block(title, duration, preferred_time)` — blocks calendar time
- `generate_meeting_brief(meeting_id)` — creates prep document
- `search_signals(query)` — searches user's signal history

### 5. Integration OAuth Manager

**Purpose:** Handle OAuth flows for Google (Calendar + Gmail) and Slack.

**Flow:**

1. User initiates connection → redirect to provider OAuth
2. Provider callback → exchange code for tokens
3. Store tokens encrypted in `integration_tokens` table (encrypted columns)
4. Token refresh handled automatically on API calls
5. Disconnect flow: revoke token + delete from database

**Security:**

- Tokens encrypted at rest using Supabase Vault
- Server-side only (never sent to client)
- Scoped to minimum required permissions
- Automatic revocation on account deletion

## API Routes

| Route                               | Method | Purpose                               |
| ----------------------------------- | ------ | ------------------------------------- |
| `/api/signals/gmail`                | POST   | Gmail push notification webhook       |
| `/api/signals/slack`                | POST   | Slack Events API webhook              |
| `/api/signals/calendar`             | POST   | Google Calendar push webhook          |
| `/api/cron/sync`                    | GET    | Periodic signal sync (Vercel Cron)    |
| `/api/cron/score`                   | GET    | Periodic scoring recalculation        |
| `/api/scoring/recalculate`          | POST   | Trigger scoring for a user            |
| `/api/chat`                         | POST   | Chat message + streaming response     |
| `/api/calendar/action`              | POST   | Execute calendar modification         |
| `/api/integrations/google/connect`  | GET    | Start Google OAuth                    |
| `/api/integrations/google/callback` | GET    | Google OAuth callback                 |
| `/api/integrations/slack/connect`   | GET    | Start Slack OAuth                     |
| `/api/integrations/slack/callback`  | GET    | Slack OAuth callback                  |
| `/api/billing/webhook`              | POST   | Stripe webhook handler                |
| `/api/billing/checkout`             | POST   | Create Stripe Checkout session        |
| `/api/billing/portal`               | POST   | Create Stripe Customer Portal session |

## Real-Time Strategy

**Supabase Realtime subscriptions:**

- `activities` table — Command Center updates when scores change
- `signals` table — Dashboard updates when new signals arrive
- `chat_messages` table — Chat UI updates

**Polling fallback:**

- React Query with 30s refetch interval for non-critical data
- Stale-while-revalidate pattern for dashboard metrics

## Deployment

- **Frontend + API:** Vercel (automatic from `main` branch)
- **Database:** Supabase (managed PostgreSQL)
- **Cache:** Upstash Redis (serverless, Vercel-native)
- **Billing:** Stripe (webhooks to Vercel)
- **Monitoring:** Vercel Analytics + Sentry
- **CI/CD:** GitHub Actions → Vercel Preview Deployments on PR

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
ANTHROPIC_API_KEY=

# Integrations
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=

# Billing
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Cache
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# App
NEXT_PUBLIC_APP_URL=
```

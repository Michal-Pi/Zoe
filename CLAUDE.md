# Zoe — Project Constitution

## What This Project Is

Zoe is a $15/month agentic personal assistant that connects to Slack, Gmail, and Google Calendar to surface the user's highest-priority action at any moment. It consists of an Impact Dashboard, Command Center (priority engine), Calendar Intelligence, and a context-aware Chat interface. The MVP targets high-autonomy professionals who feel overloaded by meetings and open loops.

## Tech Stack

- **Framework:** Next.js 15 (App Router) + TypeScript 5.5+
- **Styling:** Tailwind CSS v4 + shadcn/ui components
- **Database:** Supabase (PostgreSQL + Auth + Realtime + Storage)
- **Hosting:** Vercel (auto-deploy from main branch)
- **AI:** Anthropic Claude (Haiku 4.5 for classification, Sonnet 4.6 for generation) via Vercel AI SDK
- **Billing:** Stripe (Checkout + Customer Portal + Webhooks)
- **Cache:** Upstash Redis
- **Data fetching:** React Query (TanStack Query)
- **Validation:** Zod
- **Dates:** date-fns

## Folder Structure

```
src/
├── app/              # Next.js App Router (pages + API routes)
│   ├── (auth)/       # Login, signup, onboarding
│   ├── (dashboard)/  # Protected app pages
│   ├── (marketing)/  # Public pages
│   └── api/          # API routes (signals, scoring, chat, billing, integrations, cron)
├── components/
│   ├── ui/           # shadcn/ui base components — NEVER create parallel UI primitives
│   ├── dashboard/    # Impact Dashboard components
│   ├── command/      # Command Center components
│   ├── calendar/     # Calendar Intelligence components
│   ├── chat/         # Zoe Chat components
│   └── shared/       # App shell, nav, sidebar
├── lib/
│   ├── supabase/     # Supabase client (browser + server)
│   ├── ai/           # LLM providers, prompts, schemas
│   ├── scoring/      # Scoring engine logic
│   ├── signals/      # Signal processing
│   └── integrations/ # Google, Gmail, Slack API clients
├── domain/           # Pure TypeScript types (no framework deps)
├── hooks/            # React hooks
└── utils/            # Utility functions
```

## Commands

```bash
pnpm dev              # Start Next.js dev server
pnpm build            # Production build
pnpm lint             # ESLint
pnpm typecheck        # TypeScript strict check
pnpm test             # Run tests (Vitest)
pnpm db:migrate       # Apply Supabase migrations
pnpm db:reset         # Reset local Supabase database
pnpm db:seed          # Seed development data
```

## Design System Rules

- All UI uses shadcn/ui from `components/ui/`. Import as: `import { Button } from '@/components/ui/button'`
- NEVER import from 'shadcn' or install UI libraries via npm. shadcn components are copied into the project.
- Use semantic color tokens via Tailwind classes mapped to CSS variables: `text-primary`, `bg-surface`, `border-border`. NEVER use raw Tailwind colors (`bg-blue-500`, `text-gray-600`).
- New components must use `forwardRef` + `cn()` for className merging.
- Before creating any new component, check `components/ui/` first.
- Scores displayed in `font-mono`. Activity cards use the `Card` component.
- All interactive elements must have visible focus rings and keyboard support.
- Wrap animations in `prefers-reduced-motion` media query.
- Font stack: Satoshi (display), Inter (body), JetBrains Mono (scores/stats).
- Color palette: violet primary (#6C5CE7), coral secondary (#FF6B6B), teal accent (#00B894).

## Coding Standards

- TypeScript strict mode. No `any` types. No `@ts-ignore`.
- All API responses validated with Zod schemas.
- All LLM responses parsed via Zod structured output schemas.
- Server-side Supabase operations use `createServerClient` with `SUPABASE_SERVICE_ROLE_KEY`. Client-side uses `createBrowserClient` with anon key.
- OAuth tokens NEVER sent to the client. Stored in `integration_tokens` table with service-role-only RLS.
- All external-facing actions (send email, modify calendar, send Slack message) require explicit user confirmation in the UI. No silent side-effects.
- API routes return standard shape: `{ data, error }`. Use appropriate HTTP status codes.
- Errors logged with context (userId, route, action). Never expose stack traces to client.

## Architecture Patterns

- **Data access:** Supabase client in `lib/supabase/`. No raw SQL in components.
- **Data fetching:** React Query hooks in `hooks/`. Supabase Realtime for live updates on activities and signals.
- **AI calls:** All via `lib/ai/`. Use Vercel AI SDK `generateText()` or `streamText()`. Never call Anthropic SDK directly.
- **Prompt templates:** In `lib/ai/prompts/`. Parameterized functions, not string concatenation.
- **Structured output:** Every LLM call has a Zod schema for response parsing.
- **Integrations:** OAuth flows in `/api/integrations/[provider]/`. Token management in `lib/integrations/`.

## Testing

- Unit tests for scoring engine and signal classification logic.
- Integration tests for API routes (mock Supabase, test request/response).
- E2E tests for critical flows (Playwright).
- Tests live alongside source files: `*.test.ts` / `*.test.tsx`.

## What Agents Should NEVER Do

- Install new npm dependencies without explicit approval.
- Modify the auth system or RLS policies without explicit instruction.
- Send real emails, Slack messages, or modify calendars in development (use mocks).
- Store secrets in code or commit `.env` files.
- Use Firebase or Firestore (this is a Supabase project).
- Create custom auth middleware — use Supabase Auth + Next.js middleware.
- Add inline styles or emotion/styled-components. Tailwind + shadcn only.
- Skip Zod validation on any API boundary.

## Key Reference Documents

- `PRD.md` — Product requirements, acceptance criteria, user flows
- `ADR-001-database-and-backend.md` — Why Supabase over Firebase
- `ADR-002-frontend-and-stack.md` — Frontend stack decisions
- `ADR-003-auth-and-billing.md` — Auth and Stripe billing
- `ADR-004-ai-and-llm-strategy.md` — LLM model allocation and cost strategy
- `TECHNICAL-ARCHITECTURE.md` — System design, API routes, project structure
- `DATA-MODEL.md` — PostgreSQL schema, RLS policies, key queries
- `DESIGN-SYSTEM.md` — Visual language, tokens, component patterns
- `EPIC-BREAKDOWN.md` — Phased build plan with dependencies

## Reuse From LifeOS_2

This project selectively ports code from `/Users/michalpilawski/Dropbox/Cursor_Projects/LifeOS_2/`:

- Domain types from `packages/*/domain/` — pure TypeScript, no Firebase
- Google Calendar API logic from `functions/src/calendar/` — adapt for Supabase token storage
- Gmail API logic from `functions/src/mailbox/` — adapt similarly
- AI provider patterns from `functions/src/agents/` — simplify for Vercel AI SDK
- Calendar computation (recurrence, free/busy) from `packages/calendar/`
- Do NOT copy Firestore adapters, Firebase Auth code, or Cloud Function scaffolding.

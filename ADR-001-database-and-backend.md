# ADR-001: Database and Backend — Supabase + Vercel vs Firebase

## Status: ACCEPTED

## Context

Zoe is a new product built on top of domain logic and integration patterns from LifeOS_2, which currently runs on Firebase (Firestore + Cloud Functions + Firebase Auth). The founder prefers Supabase + Vercel for Zoe, citing developer experience, PostgreSQL flexibility, and Vercel's deployment story.

### LifeOS_2 Firebase Coupling Analysis

| Metric                                                           | Count                 |
| ---------------------------------------------------------------- | --------------------- |
| Files importing Firebase SDK                                     | 110 (19% of codebase) |
| Firestore repository adapters                                    | 37                    |
| Port/interface definitions (reusable)                            | 52                    |
| Cloud Functions                                                  | 44                    |
| Files using onSnapshot() listeners                               | 128                   |
| Files using Firestore field values (arrayUnion, increment, etc.) | 2,379 matches         |

### Key Findings

- LifeOS_2 uses a **clean port/adapter architecture** — domain logic is decoupled from Firestore
- However, adapters, listeners, and Cloud Function triggers are deeply Firebase-specific
- Full migration of LifeOS_2 to Supabase would take 2–3 person-months and sacrifice offline-first + real-time features
- Zoe only needs a **subset** of LifeOS_2 features (~8–10 repositories vs 37)

## Decision

**Use Supabase (PostgreSQL) + Vercel for Zoe as a new codebase**, selectively porting domain logic and integration code from LifeOS_2.

### What We Reuse From LifeOS_2 (as-is or with minor adaptation)

- **Domain types and interfaces** from `@lifeos/agents`, `@lifeos/calendar`, `@lifeos/core` — pure TypeScript, no Firebase dependency
- **AI agent orchestration patterns** — LangChain/LangGraph workflow logic, provider services (OpenAI, Anthropic, Google, XAI)
- **Integration API logic** — Gmail API calls, Google Calendar API calls, Slack API calls (the actual HTTP/SDK calls, not the Firestore storage)
- **Calendar computation logic** — recurrence expansion, free/busy calculation, conflict detection
- **Scoring algorithms** — priority scoring concepts, meeting classification logic

### What We Build New for Supabase

- **~10 Supabase repositories** (vs 37 Firestore ones) — Zoe has a simpler data model
- **Supabase Auth** — compatible with Google OAuth, email/password (nearly identical to Firebase Auth API surface)
- **Vercel serverless functions** — replace Cloud Functions for HTTP endpoints, AI calls, integration webhooks
- **Supabase Realtime** — for Command Center live updates (replaces onSnapshot for the subset we need)
- **PostgreSQL triggers + Supabase Edge Functions** — replace Firestore document triggers
- **Vercel Cron** — replace Firebase scheduled functions

### What We Intentionally Drop

- Offline-first persistence (Zoe is online-first; cached data with staleness indicators is sufficient)
- Complex multi-tab sync coordination
- Firestore's automatic retry/resilience layer (replace with simpler HTTP retry + SWR/React Query caching)

## Alternatives Considered

### Alternative 1: Keep Firebase

- **Pro:** Maximum code reuse (copy-paste adapters)
- **Pro:** Real-time and offline-first for free
- **Con:** Firestore's NoSQL model is poor for the relational queries Zoe's scoring engine needs (joins, aggregations, window functions)
- **Con:** Cloud Functions cold starts hurt UX for a $15/month product
- **Con:** Firebase pricing scales poorly for heavy-read patterns (Zoe reads a lot of signals)
- **Con:** Harder to run complex scoring queries without denormalization

### Alternative 2: Dual Backend (Supabase for new + Firebase for reused)

- **Pro:** Fastest path to MVP
- **Con:** Two auth systems, two databases, two deployment targets = operational nightmare
- **Con:** Data consistency across backends is error-prone
- **Con:** Doubles infrastructure costs and monitoring surface area
- **Verdict:** Rejected. The complexity tax outweighs the speed benefit.

### Alternative 3: Full LifeOS_2 Migration to Supabase

- **Pro:** Single codebase, everything on Supabase
- **Con:** 2–3 person-months of migration work before building any Zoe features
- **Con:** Risk of breaking working LifeOS_2 features during migration
- **Verdict:** Rejected. Zoe is a new product. Build it clean.

## Why Supabase Wins for Zoe Specifically

1. **Relational data model fits Zoe's scoring engine.** The Command Center needs to JOIN signals across email, Slack, and calendar, aggregate scores, and run window functions for trend analysis. PostgreSQL handles this natively. Firestore would require complex denormalization and client-side joins.

2. **Row-Level Security (RLS) is simpler than Firestore rules.** Supabase RLS policies are SQL-native and easier to test. Firestore rules become unwieldy at scale.

3. **Vercel serverless eliminates cold starts.** Vercel's edge functions + serverless functions have near-zero cold start for the HTTP layer. Firebase Cloud Functions v2 still has 1–3s cold starts.

4. **Cost model aligns with Zoe's usage pattern.** Supabase charges on compute + storage (predictable). Firestore charges per read/write operation (unpredictable for a signal-heavy product).

5. **PostgreSQL enables future features cheaply.** Full-text search (pg_trgm), vector embeddings (pgvector), time-series queries, materialized views for dashboards — all built into PostgreSQL.

## Trade-offs Accepted

- **No automatic offline persistence.** Users need internet. We'll use React Query caching for perceived performance.
- **Real-time is more limited.** Supabase Realtime works on table-level changes, not document-level granularity. We'll design around this with polling + targeted subscriptions.
- **Adapter rewrite cost.** ~10 new repository implementations needed. This is manageable.
- **Integration code needs adaptation.** Gmail/Calendar/Slack API call logic is reusable, but the token storage and refresh logic needs to be rewritten for Supabase/Vercel.

## Consequences

- New Zoe codebase in `/Zoe` with its own `package.json`, Supabase config, Vercel config
- Selective code copying from LifeOS_2 domain packages (not npm linking — clean separation)
- Supabase project setup required (database, auth, storage, edge functions)
- Vercel project setup required (deployment, environment variables, cron jobs)
- Stripe integration for billing (new, not in LifeOS_2)

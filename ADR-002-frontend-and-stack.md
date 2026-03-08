# ADR-002: Frontend Stack and Framework

## Status: ACCEPTED

## Decision

**Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + React Query**

### Rationale

| Factor                | Choice                       | Why                                                                                                                                                                  |
| --------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**         | Next.js 15 (App Router)      | Convention-heavy, Vercel-native, excellent AI agent compatibility. App Router gives us server components for dashboard performance and API routes for backend logic. |
| **Language**          | TypeScript 5.5+              | Non-negotiable for code reuse from LifeOS_2 domain packages. Type safety catches agent-generated errors at compile time.                                             |
| **Styling**           | Tailwind CSS v4              | Declarative classes are AI-readable. Semantic design tokens via CSS variables. No runtime CSS-in-JS overhead.                                                        |
| **Component Library** | shadcn/ui                    | Components live in our codebase (not node_modules). AI agents can read and modify them. Radix primitives for accessibility.                                          |
| **Data Fetching**     | React Query (TanStack Query) | Replaces Firestore's onSnapshot with smart caching, background refetch, optimistic updates. Pairs well with Supabase client.                                         |
| **Validation**        | Zod                          | Already used in LifeOS_2. Schema validation for API boundaries.                                                                                                      |
| **Date Handling**     | date-fns                     | Already used in LifeOS_2. Tree-shakeable, immutable.                                                                                                                 |

### Why Not Keep Vite + React Router (LifeOS_2 Stack)

LifeOS_2 uses Vite 7 + React Router v7 (SPA). This works but:

- No server-side rendering — bad for SEO on marketing pages and booking pages
- No API routes — need separate backend deployment
- No edge middleware — can't do auth checks at the edge
- Vercel deploys Next.js natively with zero config

Next.js gives us API routes (replacing Cloud Functions), SSR (for public pages), and edge middleware (for auth) in one deployment.

### Migration Path From LifeOS_2 React Components

- React components are reusable (React is React)
- LifeOS_2 uses custom CSS tokens → we'll map to Tailwind + shadcn semantic tokens
- LifeOS_2 uses Radix UI → shadcn/ui is built on Radix (same primitives)
- TipTap editor can be carried over if we need rich text
- React Router routes → Next.js App Router pages (file-based routing)

## Alternatives Considered

- **Vite + React Router (status quo):** Simpler, but misses SSR, API routes, and Vercel's optimizations.
- **Remix:** Good option but smaller ecosystem and less AI training data density.
- **SvelteKit:** Better performance but would require full UI rewrite (no React code reuse).

## Consequences

- Learn Next.js App Router conventions (server vs client components)
- Marketing/landing pages get SSR for free
- API routes live alongside frontend code (simpler deployment)
- Bundle size managed by Next.js automatic code splitting

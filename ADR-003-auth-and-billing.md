# ADR-003: Authentication and Billing

## Status: ACCEPTED

## Decision

**Supabase Auth + Stripe Billing**

### Authentication: Supabase Auth

- **Google OAuth** as primary sign-in (target users live in Google Workspace)
- **Email/password** as fallback
- Supabase Auth provides: JWT tokens, session management, OAuth provider support, email verification, password reset
- RLS policies use `auth.uid()` — zero custom middleware needed for data access control
- Edge middleware in Next.js validates session on every request

**Why not NextAuth/Auth.js?**

- Extra dependency when Supabase Auth already handles everything
- Supabase Auth integrates natively with RLS — no token-to-user mapping layer needed
- One less piece of infrastructure to manage

### Billing: Stripe

- **Stripe Checkout** for subscription creation (hosted page, PCI compliant by default)
- **Stripe Customer Portal** for subscription management (cancel, upgrade, payment method)
- **Stripe Webhooks** → Vercel serverless function → update `subscriptions` table in Supabase
- Products: Free Trial (14 days) → Individual ($15/month or $144/year)

**Subscription Lifecycle:**

1. User signs up → Supabase creates auth user → Stripe customer created via webhook
2. Trial starts (14 days, full features)
3. Trial expires → paywall shown → Stripe Checkout → subscription active
4. Stripe webhook updates `subscriptions.status` in Supabase
5. RLS policy checks `subscriptions.status = 'active' OR trial_ends_at > now()`

**Key Stripe Tables in Supabase:**

```sql
customers (id, user_id, stripe_customer_id)
subscriptions (id, user_id, stripe_subscription_id, status, plan, trial_ends_at, current_period_end)
```

## Alternatives Considered

- **Firebase Auth:** Would work but creates split infrastructure when everything else is Supabase.
- **Clerk:** Premium product but $25/month for 1K MAU; unnecessary cost for MVP.
- **LemonSqueezy/Paddle:** Good for MoR (Merchant of Record) but overkill for US-only MVP.

## Consequences

- Supabase Auth handles all auth flows (sign-up, sign-in, OAuth, password reset)
- Stripe handles all billing (no custom payment logic)
- RLS enforces access control at the database level
- Need to handle Stripe webhook idempotency carefully
- Trial-to-paid conversion tracking via Stripe events + custom analytics

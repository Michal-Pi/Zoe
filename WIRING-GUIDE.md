# Zoe — External Services Wiring Guide

Follow these steps in order. Each step tells you exactly what to do and what value to copy where.

---

## Step 1: Google Cloud Console

1. Go to https://console.cloud.google.com
2. Create a new project (or use existing) named "Zoe"
3. Enable these APIs (APIs & Services > Library):
   - Google Calendar API
   - Gmail API
4. Go to APIs & Services > OAuth consent screen:
   - User type: External
   - App name: Zoe
   - Support email: your email
   - Scopes: add `calendar`, `calendar.events`, `gmail.modify`, `userinfo.email`, `userinfo.profile`
   - Test users: add your own email
5. Go to APIs & Services > Credentials > Create Credentials > OAuth 2.0 Client ID:
   - Application type: Web application
   - Name: Zoe Web
   - Authorized redirect URIs: add BOTH:
     - `http://localhost:3000/api/integrations/google/callback` (dev)
     - `https://YOUR-DOMAIN.com/api/integrations/google/callback` (prod)
6. Copy the values:
   - Client ID -> `GOOGLE_CLIENT_ID`
   - Client Secret -> `GOOGLE_CLIENT_SECRET`

---

## Step 2: Slack App

1. Go to https://api.slack.com/apps > Create New App > From scratch
   - App name: Zoe
   - Workspace: your dev workspace
2. Go to OAuth & Permissions > Scopes > Bot Token Scopes, add:
   - `channels:history`
   - `channels:read`
   - `chat:write`
   - `groups:history`
   - `groups:read`
   - `im:history`
   - `im:read`
   - `mpim:history`
   - `mpim:read`
   - `users:read`
   - `users:read.email`
3. Go to OAuth & Permissions > Redirect URLs, add BOTH:
   - `http://localhost:3000/api/integrations/slack/callback` (dev)
   - `https://YOUR-DOMAIN.com/api/integrations/slack/callback` (prod)
4. Go to Event Subscriptions:
   - Enable Events: ON
   - Request URL: `https://YOUR-DOMAIN.com/api/signals/slack`
     (Note: Slack will send a challenge request to verify. The endpoint must be deployed first. You can set this up after first deploy.)
   - Subscribe to bot events:
     - `message.channels`
     - `message.groups`
     - `message.im`
     - `message.mpim`
5. Go to Basic Information, copy:
   - Client ID -> `SLACK_CLIENT_ID`
   - Client Secret -> `SLACK_CLIENT_SECRET`
   - Signing Secret -> `SLACK_SIGNING_SECRET`

---

## Step 3: Stripe

1. Go to https://dashboard.stripe.com
2. Create products (Product catalog > Add product):
   - Product name: Zoe Individual
   - Price 1: $15/month (recurring, monthly)
   - Price 2: $144/year (recurring, yearly) — description: "$12/month billed annually"
3. Copy the price IDs (start with `price_`):
   - Monthly price ID -> `STRIPE_PRICE_MONTHLY`
   - Yearly price ID -> `STRIPE_PRICE_YEARLY`
4. Go to Developers > API keys:
   - Publishable key -> `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - Secret key -> `STRIPE_SECRET_KEY`
5. Go to Developers > Webhooks > Add endpoint:
   - Endpoint URL: `https://YOUR-DOMAIN.com/api/billing/webhook`
   - Events to listen for:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
     - `checkout.session.completed`
   - Copy Signing secret -> `STRIPE_WEBHOOK_SECRET`

For local development, install Stripe CLI:
```bash
brew install stripe/stripe-cli/stripe
stripe login
stripe listen --forward-to localhost:3000/api/billing/webhook
```
The CLI will print a webhook signing secret for local use.

---

## Step 4: Upstash Redis

1. Go to https://console.upstash.com
2. Create a new Redis database:
   - Name: zoe-cache
   - Region: pick closest to your Vercel deployment region (usually us-east-1)
   - Type: Regional
3. Copy from the REST API section:
   - REST URL -> `UPSTASH_REDIS_REST_URL`
   - REST Token -> `UPSTASH_REDIS_REST_TOKEN`

---

## Step 5: Sentry

1. Go to https://sentry.io > Create project
   - Platform: Next.js
   - Project name: zoe
2. Copy:
   - DSN -> `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` (same value)
   - Organization slug -> `SENTRY_ORG`
   - Project name -> `SENTRY_PROJECT`

---

## Step 6: Supabase

1. Go to https://supabase.com/dashboard
2. Your project should already exist. Verify:
   - Authentication > Providers > Google is enabled (use same Client ID/Secret from Step 1)
   - Authentication > Email Auth is enabled
   - Database > Tables > verify all tables exist with RLS enabled
3. Copy (Settings > API):
   - Project URL -> `NEXT_PUBLIC_SUPABASE_URL`
   - anon public key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role secret key -> `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 7: Vercel

1. Go to https://vercel.com/dashboard > your Zoe project
2. Settings > Environment Variables — add ALL of the following:

```
NEXT_PUBLIC_SUPABASE_URL=<from Step 6>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Step 6>
SUPABASE_SERVICE_ROLE_KEY=<from Step 6>
ANTHROPIC_API_KEY=<your Anthropic key>
GOOGLE_CLIENT_ID=<from Step 1>
GOOGLE_CLIENT_SECRET=<from Step 1>
SLACK_CLIENT_ID=<from Step 2>
SLACK_CLIENT_SECRET=<from Step 2>
SLACK_SIGNING_SECRET=<from Step 2>
STRIPE_SECRET_KEY=<from Step 3>
STRIPE_WEBHOOK_SECRET=<from Step 3>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<from Step 3>
STRIPE_PRICE_MONTHLY=<from Step 3>
STRIPE_PRICE_YEARLY=<from Step 3>
UPSTASH_REDIS_REST_URL=<from Step 4>
UPSTASH_REDIS_REST_TOKEN=<from Step 4>
SENTRY_DSN=<from Step 5>
NEXT_PUBLIC_SENTRY_DSN=<from Step 5>
SENTRY_ORG=<from Step 5>
SENTRY_PROJECT=<from Step 5>
CRON_SECRET=<generate a random 32-char string>
NEXT_PUBLIC_APP_URL=https://YOUR-DOMAIN.com
```

3. Verify your Vercel plan supports cron jobs (Pro plan needed for intervals <1 day).

---

## Step 8: Domain (when ready to launch)

1. Buy domain
2. Add to Vercel project (Settings > Domains)
3. Update `NEXT_PUBLIC_APP_URL` in Vercel env vars
4. Update all redirect URIs in Google Cloud Console and Slack App
5. Update Stripe webhook endpoint URL

---

## Step 9: Local .env.local

Create `.env.local` in the project root with the same variables as Step 7, but using localhost URLs and test/dev keys where applicable.

---

## Checklist

- [ ] Google Cloud: OAuth credentials created, APIs enabled
- [ ] Slack: App created, scopes added, redirect URLs set
- [ ] Stripe: Products created, webhook endpoint added
- [ ] Upstash: Redis database created
- [ ] Sentry: Project created
- [ ] Supabase: Google provider enabled, migrations applied
- [ ] Vercel: All env vars set
- [ ] Local: .env.local populated
- [ ] Domain: configured (when ready)

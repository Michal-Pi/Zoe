import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    _stripe = new Stripe(key, {
      apiVersion: "2026-02-25.clover",
    });
  }
  return _stripe;
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`${name} is not configured`);
  return val;
}

export const PLANS = {
  individual: {
    get monthly() {
      return requireEnv("STRIPE_PRICE_MONTHLY");
    },
    get yearly() {
      return requireEnv("STRIPE_PRICE_YEARLY");
    },
  },
} as const;

export const TRIAL_DAYS = 14;

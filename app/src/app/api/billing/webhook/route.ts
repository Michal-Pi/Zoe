import { NextResponse } from "next/server";
import { getStripe } from "@/lib/billing/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import Stripe from "stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook Error: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 400 }
    );
  }

  const supabase = await createServiceRoleClient();

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;

      const { data: customer } = await supabase
        .from("customers")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (customer) {
        const updates: Record<string, unknown> = {
          stripe_subscription_id: subscription.id,
          status: subscription.status,
          cancel_at_period_end: subscription.cancel_at_period_end,
        };

        // Access period dates safely (Stripe API versions vary)
        const sub = subscription as unknown as Record<string, unknown>;
        if (typeof sub.current_period_start === "number") {
          updates.current_period_start = new Date(
            (sub.current_period_start as number) * 1000
          ).toISOString();
        }
        if (typeof sub.current_period_end === "number") {
          updates.current_period_end = new Date(
            (sub.current_period_end as number) * 1000
          ).toISOString();
        }

        await supabase
          .from("subscriptions")
          .update(updates)
          .eq("user_id", customer.user_id)
          .eq("stripe_subscription_id", subscription.id);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;

      const { data: customer } = await supabase
        .from("customers")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (customer) {
        await supabase
          .from("subscriptions")
          .update({
            status: "canceled",
            cancel_at_period_end: false,
          })
          .eq("user_id", customer.user_id)
          .eq("stripe_subscription_id", subscription.id);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}

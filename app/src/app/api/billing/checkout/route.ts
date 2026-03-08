import { NextResponse } from "next/server";
import { getStripe, PLANS } from "@/lib/billing/stripe";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const interval = body?.interval ?? "monthly";
  if (interval !== "monthly" && interval !== "yearly") {
    return NextResponse.json({ error: "Invalid interval. Must be 'monthly' or 'yearly'." }, { status: 400 });
  }

  const serviceClient = await createServiceRoleClient();

  // Get or create Stripe customer
  let { data: customer } = await serviceClient
    .from("customers")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (!customer) {
    const stripeCustomer = await getStripe().customers.create({
      email: user.email,
      metadata: { user_id: user.id },
    });

    await serviceClient.from("customers").insert({
      user_id: user.id,
      stripe_customer_id: stripeCustomer.id,
    });

    customer = { stripe_customer_id: stripeCustomer.id };
  }

  const priceId =
    interval === "yearly" ? PLANS.individual.yearly : PLANS.individual.monthly;

  const session = await getStripe().checkout.sessions.create({
    customer: customer.stripe_customer_id,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?billing=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?billing=canceled`,
    metadata: { user_id: user.id },
  });

  return NextResponse.json({ url: session.url });
}

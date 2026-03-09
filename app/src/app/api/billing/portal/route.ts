import { NextResponse } from "next/server";
import { getStripe } from "@/lib/billing/stripe";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { getAbsoluteAppUrl } from "@/lib/base-path";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const serviceClient = await createServiceRoleClient();

  const { data: customer } = await serviceClient
    .from("customers")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (!customer) {
    return NextResponse.json(
      { error: "No billing account found" },
      { status: 404 }
    );
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: customer.stripe_customer_id,
    return_url: getAbsoluteAppUrl(appUrl, "/settings"),
  });

  return NextResponse.json({ url: session.url });
}

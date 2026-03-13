import { NextResponse } from "next/server";
import {
  createServiceRoleClient,
  createServerSupabaseClient,
} from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = await createServiceRoleClient();

  // Check admin
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch usage data — last 30 days, aggregated by day and operation
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: usage, error } = await serviceClient
    .from("llm_usage")
    .select(
      "operation, model, input_tokens, output_tokens, estimated_cost_usd, created_at, user_id"
    )
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch extraction retry stats
  const { data: stuckWorkObjects } = await serviceClient
    .from("work_objects")
    .select("id, title, extraction_attempts, extraction_failed_at, user_id, updated_at")
    .eq("status", "active")
    .gt("extraction_attempts", 0)
    .order("extraction_attempts", { ascending: false })
    .limit(20);

  // Fetch user count
  const { count: totalUsers } = await serviceClient
    .from("profiles")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({
    data: {
      usage: usage ?? [],
      stuckWorkObjects: stuckWorkObjects ?? [],
      totalUsers: totalUsers ?? 0,
    },
  });
}

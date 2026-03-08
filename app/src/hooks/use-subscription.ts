"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface Subscription {
  status: string;
  plan: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export function useSubscription() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(
          "status, plan, trial_ends_at, current_period_end, cancel_at_period_end"
        )
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        status: data.status,
        plan: data.plan,
        trialEndsAt: data.trial_ends_at,
        currentPeriodEnd: data.current_period_end,
        cancelAtPeriodEnd: data.cancel_at_period_end,
      } as Subscription;
    },
  });
}

export function useIsTrialActive() {
  const { data: sub, isLoading } = useSubscription();
  if (isLoading || !sub) return false;

  if (sub.status === "trialing" && sub.trialEndsAt) {
    return new Date(sub.trialEndsAt) > new Date();
  }
  return false;
}

export function useHasActiveSubscription() {
  const { data: sub, isLoading } = useSubscription();
  if (isLoading || !sub) return false;

  return (
    sub.status === "active" ||
    (sub.status === "trialing" && sub.trialEndsAt && new Date(sub.trialEndsAt) > new Date())
  );
}

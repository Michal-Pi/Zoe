"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type SubscriptionStatus = "loading" | "active" | "expired";

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SubscriptionStatus>("loading");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkSubscription() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("status, trial_ends_at")
        .eq("user_id", user.id)
        .single();

      if (!subscription) {
        setStatus("expired");
        return;
      }

      if (subscription.status === "active") {
        setStatus("active");
        return;
      }

      if (
        subscription.status === "trialing" &&
        subscription.trial_ends_at &&
        new Date(subscription.trial_ends_at) > new Date()
      ) {
        setStatus("active");
        return;
      }

      setStatus("expired");
    }

    checkSubscription();
  }, [router, supabase]);

  useEffect(() => {
    if (status === "expired") {
      router.replace("/paywall");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === "expired") {
    // Will redirect via the effect above; render nothing to avoid flash
    return null;
  }

  return <>{children}</>;
}

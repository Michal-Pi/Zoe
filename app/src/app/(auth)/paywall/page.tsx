"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export default function PaywallPage() {
  const [loading, setLoading] = useState<"monthly" | "yearly" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleCheckout(plan: "monthly" | "yearly") {
    setLoading(plan);
    setError(null);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Something went wrong");
        setLoading(null);
        return;
      }

      if (json.data?.url) {
        window.location.href = json.data.url;
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(null);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg text-center space-y-8">
        {/* Logo */}
        <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-primary text-primary-foreground font-display font-bold text-xl">
          Z
        </div>

        {/* Heading */}
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-semibold text-foreground">
            Your trial has ended
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Subscribe to keep using Zoe — your AI assistant that connects Slack,
            Gmail, and Calendar to surface your highest-priority action at any
            moment.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Monthly */}
          <Card className="relative">
            <CardContent className="p-6 space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Monthly
                </p>
                <p className="mt-1 font-display text-3xl font-semibold text-foreground">
                  $15
                  <span className="text-base font-normal text-muted-foreground">
                    /mo
                  </span>
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => handleCheckout("monthly")}
                disabled={loading !== null}
              >
                {loading === "monthly" ? "Redirecting..." : "Subscribe Monthly"}
              </Button>
            </CardContent>
          </Card>

          {/* Annual */}
          <Card className="relative border-primary">
            <CardContent className="p-6 space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Annual
                </p>
                <p className="mt-1 font-display text-3xl font-semibold text-foreground">
                  $12
                  <span className="text-base font-normal text-muted-foreground">
                    /mo
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Billed annually at $144/year
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => handleCheckout("yearly")}
                disabled={loading !== null}
              >
                {loading === "yearly" ? "Redirecting..." : "Subscribe Annually"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Save badge */}
        <p className="text-xs text-muted-foreground">
          Save 20% with the annual plan
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Log out */}
        <button
          onClick={handleLogout}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
        >
          Log out
        </button>
      </div>
    </div>
  );
}

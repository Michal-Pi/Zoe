"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/hooks/use-subscription";
import { Skeleton } from "@/components/ui/skeleton";

function getStatusColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-score-low/10 text-score-low";
    case "trialing":
      return "bg-primary/10 text-primary";
    case "canceled":
    case "past_due":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Active";
    case "trialing":
      return "Trial";
    case "canceled":
      return "Canceled";
    case "past_due":
      return "Past Due";
    default:
      return status;
  }
}

export function BillingSection() {
  const { data: subscription, isLoading } = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const handleCheckout = async (interval: "monthly" | "yearly") => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Checkout failed (${res.status})`);
      }
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error("Checkout error:", err);
      alert(err instanceof Error ? err.message : "Checkout failed. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Portal failed (${res.status})`);
      }
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error("Portal error:", err);
      alert(err instanceof Error ? err.message : "Could not open billing portal.");
    } finally {
      setPortalLoading(false);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-32" />;
  }

  const isTrialing = subscription?.status === "trialing";
  const isActive = subscription?.status === "active";
  const trialDaysLeft = subscription?.trialEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subscription.trialEndsAt).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-foreground">
            Billing
          </h3>
          {subscription && (
            <Badge
              variant="secondary"
              className={getStatusColor(subscription.status)}
            >
              {getStatusLabel(subscription.status)}
            </Badge>
          )}
        </div>

        {isTrialing && (
          <div className="rounded-lg bg-primary/5 border border-primary/10 p-4">
            <p className="text-sm font-medium text-foreground">
              {trialDaysLeft} days left in your trial
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Subscribe to keep using Zoe after your trial ends.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={() => handleCheckout("monthly")}
                disabled={checkoutLoading}
              >
                $15/month
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCheckout("yearly")}
                disabled={checkoutLoading}
              >
                $144/year (save 20%)
              </Button>
            </div>
          </div>
        )}

        {isActive && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Plan: <strong className="text-foreground">Individual</strong>
            </p>
            {subscription?.currentPeriodEnd && (
              <p className="text-sm text-muted-foreground">
                Next billing:{" "}
                <strong className="text-foreground">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString(
                    undefined,
                    { month: "long", day: "numeric", year: "numeric" }
                  )}
                </strong>
              </p>
            )}
            {subscription?.cancelAtPeriodEnd && (
              <p className="text-sm text-destructive">
                Cancels at end of billing period
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePortal}
              disabled={portalLoading}
            >
              Manage Subscription
            </Button>
          </div>
        )}

        {!isTrialing && !isActive && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your trial has ended. Subscribe to continue using Zoe.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleCheckout("monthly")}
                disabled={checkoutLoading}
              >
                $15/month
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCheckout("yearly")}
                disabled={checkoutLoading}
              >
                $144/year (save 20%)
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

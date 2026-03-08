"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ConnectionBannerProps {
  hasCalendar: boolean;
  hasEmail: boolean;
  hasSlack: boolean;
}

export function ConnectionBanner({
  hasCalendar,
  hasEmail,
  hasSlack,
}: ConnectionBannerProps) {
  const allConnected = hasCalendar && hasEmail && hasSlack;
  if (allConnected) return null;

  const missing = [
    !hasCalendar && "Google Calendar",
    !hasEmail && "Gmail",
    !hasSlack && "Slack",
  ].filter(Boolean);

  return (
    <Card className="border-primary/20 bg-surface-tertiary">
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            Connect your tools to unlock Zoe
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Missing: {missing.join(", ")}
          </p>
        </div>
        <Button size="sm" asChild>
          <a href="/settings">Connect</a>
        </Button>
      </CardContent>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { withBasePath } from "@/lib/base-path";
import type { CalendarEvent } from "@/domain/calendar";
import { PrepBlockAction } from "@/components/calendar/prep-block-action";

interface MeetingBriefPayload {
  meeting: {
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    attendeeCount: number;
    decisionDensity: string | null;
    ownershipLoad: string | null;
    prepTimeNeededMinutes: number | null;
    hasPrepBlock: boolean;
    risks: string[];
    description: string | null;
  };
  riskReasons: string[];
  topics: string[];
  prepActions: string[];
  decisionsToMake: string[];
  relatedSignals: Array<{
    id: string;
    title: string | null;
    snippet: string | null;
    senderName: string | null;
    senderEmail: string | null;
    topic: string | null;
    urgencyScore: number | null;
    receivedAt: string;
  }>;
}

function getAskZoePrompt(event: CalendarEvent): string {
  return `Prep me for "${event.title}". Focus on the risky points, related context, and the decisions I need to make.`;
}

export function MeetingBriefAction({
  event,
  variant = "default",
  size = "sm",
  label = "Prep me",
}: {
  event: CalendarEvent;
  variant?: "default" | "outline" | "secondary";
  size?: "sm" | "default";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<MeetingBriefPayload | null>(null);

  const loadBrief = async () => {
    setOpen(true);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(withBasePath("/api/calendar/meeting-brief"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: event.id }),
      });

      const payload = (await response.json()) as MeetingBriefPayload & { error?: string };
      if (!response.ok) {
        setBrief(null);
        setError(payload.error ?? "Failed to load meeting brief.");
        return;
      }

      setBrief(payload);
    } catch {
      setBrief(null);
      setError("Failed to load meeting brief.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button variant={variant} size={size} onClick={loadBrief}>
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Meeting brief</DialogTitle>
            <DialogDescription>
              Review the key context, then block prep time or ask Zoe for a deeper follow-up.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
              Building your meeting brief...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
              {error}
            </div>
          ) : brief ? (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Starts
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {new Date(brief.meeting.startAt).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Density
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {brief.meeting.decisionDensity ?? "Unknown"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Your role
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {brief.meeting.ownershipLoad ?? "Unknown"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Attendees
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {brief.meeting.attendeeCount}
                  </p>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-5">
                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Prep actions
                    </p>
                    <div className="mt-3 space-y-2">
                      {brief.prepActions.length ? (
                        brief.prepActions.map((action) => (
                          <p key={action} className="text-sm text-foreground">
                            {action}
                          </p>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Zoe did not detect any special prep actions beyond reviewing the meeting context.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Decisions to make
                    </p>
                    <div className="mt-3 space-y-2">
                      {brief.decisionsToMake.length ? (
                        brief.decisionsToMake.map((item) => (
                          <p key={item} className="text-sm text-foreground">
                            {item}
                          </p>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No explicit decisions inferred yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Risk factors
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {brief.riskReasons.length ? (
                        brief.riskReasons.map((risk) => (
                          <span
                            key={risk}
                            className="inline-flex items-center rounded-md bg-destructive/10 px-2.5 py-1 text-xs text-destructive"
                          >
                            {risk}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No major prep risks detected.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Related context
                    </p>
                    <div className="mt-3 space-y-3">
                      {brief.relatedSignals.length ? (
                        brief.relatedSignals.map((signal) => (
                          <div key={signal.id} className="space-y-1">
                            <p className="text-sm font-medium text-foreground">
                              {signal.title ?? signal.topic ?? "Related signal"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {signal.senderName ?? signal.senderEmail ?? "Unknown sender"}
                              {signal.urgencyScore != null ? ` · urgency ${signal.urgencyScore}` : ""}
                            </p>
                            {signal.snippet ? (
                              <p className="text-sm text-muted-foreground">{signal.snippet}</p>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No recent related email or Slack context was found.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <PrepBlockAction
              event={event}
              variant="outline"
              label="Block prep time"
            />
            <Button asChild>
              <Link href={`/chat?prompt=${encodeURIComponent(getAskZoePrompt(event))}`}>
                Ask Zoe
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

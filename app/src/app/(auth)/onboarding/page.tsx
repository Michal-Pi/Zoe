"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { withBasePath } from "@/lib/base-path";
import { createClient } from "@/lib/supabase/client";
import { useHasConnection } from "@/hooks/use-connections";

const STEPS = ["welcome", "google", "slack", "priorities", "hours", "done"] as const;
type Step = (typeof STEPS)[number];

export default function OnboardingPage() {
  const [requestedStep, setRequestedStep] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("welcome");
  const [priorities, setPriorities] = useState(["", "", ""]);
  const [workHoursStart, setWorkHoursStart] = useState("09:00");
  const [workHoursEnd, setWorkHoursEnd] = useState("17:00");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const googleConnected = useHasConnection("google");
  const slackConnected = useHasConnection("slack");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRequestedStep(params.get("step"));
    setSuccess(params.get("success"));
  }, []);

  useEffect(() => {
    if (requestedStep && STEPS.includes(requestedStep as Step)) {
      setStep(requestedStep as Step);
    }
  }, [requestedStep]);

  useEffect(() => {
    if (success === "google" && googleConnected) {
      setStep("slack");
    }
  }, [googleConnected, success]);

  useEffect(() => {
    if (success === "slack" && slackConnected) {
      setStep("priorities");
    }
  }, [slackConnected, success]);

  const stepIndex = STEPS.indexOf(step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const next = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };

  const prev = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  const connectGoogle = () => {
    window.location.href = withBasePath(
      "/api/integrations/google/connect?next=/onboarding?step=google"
    );
  };

  const connectSlack = () => {
    window.location.href = withBasePath(
      "/api/integrations/slack/connect?next=/onboarding?step=slack"
    );
  };

  const savePrioritiesAndHours = async () => {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      return;
    }

    // Save priorities — use upsert to avoid delete-then-insert race
    const validPriorities = priorities.filter((p) => p.trim());
    if (validPriorities.length > 0) {
      // Delete existing then insert in a single flow — upsert by user_id + sort_order
      const { error: delErr } = await supabase
        .from("strategic_priorities")
        .delete()
        .eq("user_id", user.id);

      if (!delErr) {
        await supabase.from("strategic_priorities").insert(
          validPriorities.map((title, i) => ({
            user_id: user.id,
            title: title.trim(),
            sort_order: i,
          }))
        );
      }
    }

    // Update profile with work hours and timezone
    await supabase
      .from("profiles")
      .update({
        work_hours_start: workHoursStart,
        work_hours_end: workHoursEnd,
        timezone,
        onboarding_completed: true,
      })
      .eq("id", user.id);

    setSaving(false);
  };

  const finishOnboarding = async () => {
    await savePrioritiesAndHours();
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        <div className="mb-8 h-1 w-full rounded-full bg-muted">
          <div
            className="h-1 rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step: Welcome */}
        {step === "welcome" && (
          <div className="text-center space-y-6">
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-primary text-primary-foreground font-display font-bold text-2xl">
              Z
            </div>
            <h1 className="font-display text-3xl font-semibold text-foreground">
              Welcome to Zoe
            </h1>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Your personal assistant that learns your work patterns and helps
              you focus on what matters most. Let&apos;s get you set up in 2
              minutes.
            </p>
            <Button size="lg" onClick={next}>
              Get Started
            </Button>
          </div>
        )}

        {/* Step: Google */}
        {step === "google" && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                Connect Google
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Zoe uses your Calendar and Gmail to understand your workday and
                prioritize what needs attention.
              </p>
            </div>

            <Card>
              <CardContent className="p-6 text-center space-y-4">
                {googleConnected ? (
                  <>
                    <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-score-low/10">
                      <CheckIcon className="h-6 w-6 text-score-low" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      Google connected
                    </p>
                  </>
                ) : (
                  <>
                    <GoogleIcon className="h-10 w-10 mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      Calendar events and email signals will be synced
                      automatically.
                    </p>
                    <Button onClick={connectGoogle} variant="outline">
                      Connect Google Account
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={prev}>
                Back
              </Button>
              <Button onClick={next}>
                {googleConnected ? "Continue" : "Skip for now"}
              </Button>
            </div>
          </div>
        )}

        {/* Step: Slack */}
        {step === "slack" && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                Connect Slack
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Let Zoe monitor your Slack channels and surface important
                messages.
              </p>
            </div>

            <Card>
              <CardContent className="p-6 text-center space-y-4">
                {slackConnected ? (
                  <>
                    <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-score-low/10">
                      <CheckIcon className="h-6 w-6 text-score-low" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      Slack connected
                    </p>
                  </>
                ) : (
                  <>
                    <SlackIcon className="h-10 w-10 mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      Messages, mentions, and DMs will be ingested as signals.
                    </p>
                    <Button onClick={connectSlack} variant="outline">
                      Connect Slack Workspace
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={prev}>
                Back
              </Button>
              <Button onClick={next}>
                {slackConnected ? "Continue" : "Skip for now"}
              </Button>
            </div>
          </div>
        )}

        {/* Step: Priorities */}
        {step === "priorities" && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                Your Strategic Priorities
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                What are you focused on? Zoe uses these to score and rank your
                activities.
              </p>
            </div>

            <div className="space-y-3">
              {priorities.map((priority, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {i + 1}
                  </span>
                  <Input
                    placeholder={
                      i === 0
                        ? "e.g., Launch Q2 product roadmap"
                        : i === 1
                          ? "e.g., Hire senior engineer"
                          : "e.g., Close Acme Corp deal"
                    }
                    value={priority}
                    onChange={(e) => {
                      const next = [...priorities];
                      next[i] = e.target.value;
                      setPriorities(next);
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={prev}>
                Back
              </Button>
              <Button onClick={next}>Continue</Button>
            </div>
          </div>
        )}

        {/* Step: Work Hours */}
        {step === "hours" && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                Work Hours
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                When is your workday? Zoe calculates available execution time
                based on this.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">
                  Start
                </label>
                <Input
                  type="time"
                  value={workHoursStart}
                  onChange={(e) => setWorkHoursStart(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">
                  End
                </label>
                <Input
                  type="time"
                  value={workHoursEnd}
                  onChange={(e) => setWorkHoursEnd(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {Intl.supportedValuesOf("timeZone").map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={prev}>
                Back
              </Button>
              <Button onClick={next}>Continue</Button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="text-center space-y-6">
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-score-low/10">
              <CheckIcon className="h-8 w-8 text-score-low" />
            </div>
            <h2 className="font-display text-2xl font-semibold text-foreground">
              You&apos;re all set!
            </h2>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Zoe is already analyzing your signals and building your
              personalized dashboard.
            </p>
            <Button size="lg" onClick={finishOnboarding} disabled={saving}>
              {saving ? "Saving..." : "Go to Dashboard"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12L10 17L20 7" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function SlackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"
        fill="#E01E5A"
      />
      <path
        d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"
        fill="#36C5F0"
      />
      <path
        d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"
        fill="#2EB67D"
      />
      <path
        d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"
        fill="#ECB22E"
      />
    </svg>
  );
}

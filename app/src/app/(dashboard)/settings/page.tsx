"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { BillingSection } from "@/components/settings/billing-section";
import { withBasePath } from "@/lib/base-path";

interface Connection {
  id: string;
  provider: string;
  email: string | null;
  status: string;
  connected_at: string;
  last_sync_at: string | null;
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const email = searchParams.get("email");

    if (success === "google") {
      // Sanitize email display (comes from query params)
      const safeEmail = email?.replace(/[<>&"']/g, "") ?? "";
      toast.success(`Google connected${safeEmail ? `: ${safeEmail}` : ""}`);
    }
    if (success === "slack") {
      const safeTeam = email?.replace(/[<>&"']/g, "") ?? "";
      toast.success(`Slack connected${safeTeam ? `: ${safeTeam}` : ""}`);
    }
    if (error) {
      // Don't display raw error from URL — use safe mapping
      const errorMessages: Record<string, string> = {
        token_exchange: "Failed to connect. Please try again.",
        invalid_state: "Connection expired. Please try again.",
        user_mismatch: "Authentication error. Please log in again.",
        missing_params: "Missing parameters. Please try again.",
        slack_auth: "Slack connection failed. Please try again.",
      };
      toast.error(errorMessages[error] ?? "Connection failed. Please try again.");
    }
  }, [searchParams]);

  useEffect(() => {
    async function fetchConnections() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("integration_connections")
        .select("*")
        .order("connected_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch connections:", error);
        toast.error("Failed to load integrations.");
      }
      setConnections(data ?? []);
      setLoading(false);
    }

    fetchConnections();
  }, []);

  const googleConnection = connections.find(
    (c) => c.provider === "google" && c.status === "active"
  );
  const slackConnection = connections.find(
    (c) => c.provider === "slack" && c.status === "active"
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your integrations and preferences.
        </p>
      </div>

      {/* Integrations */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Integrations
        </h2>

        <IntegrationCard
          name="Google"
          description="Calendar, Gmail — sync your meetings and email"
          connected={!!googleConnection}
          email={googleConnection?.email ?? undefined}
          lastSyncAt={googleConnection?.last_sync_at ?? undefined}
          connectUrl={withBasePath("/api/integrations/google/connect")}
          reconnectUrl={withBasePath("/api/integrations/google/connect?next=/settings")}
          loading={loading}
        />

        <IntegrationCard
          name="Slack"
          description="Channels, DMs — monitor your active threads"
          connected={!!slackConnection}
          email={slackConnection?.email ?? undefined}
          lastSyncAt={slackConnection?.last_sync_at ?? undefined}
          connectUrl={withBasePath("/api/integrations/slack/connect")}
          loading={loading}
        />
      </section>

      {/* Writing Style */}
      <WritingStyleSection />

      {/* Appearance */}
      <AppearanceSection />

      {/* Billing */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Billing
        </h2>
        <BillingSection />
      </section>
    </div>
  );
}

function IntegrationCard({
  name,
  description,
  connected,
  email,
  lastSyncAt,
  connectUrl,
  reconnectUrl,
  loading,
  comingSoon,
}: {
  name: string;
  description: string;
  connected: boolean;
  email?: string;
  lastSyncAt?: string;
  connectUrl: string;
  reconnectUrl?: string;
  loading: boolean;
  comingSoon?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{name}</CardTitle>
            <CardDescription className="mt-0.5">{description}</CardDescription>
          </div>
          {connected ? (
            <Badge
              variant="secondary"
              className="bg-score-low/10 text-score-low"
            >
              Connected
            </Badge>
          ) : comingSoon ? (
            <Badge variant="secondary">Coming soon</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {connected ? (
          <div className="flex items-start justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              <p>{email}</p>
              {lastSyncAt && (
                <p className="mt-1">
                  Last synced:{" "}
                  {new Date(lastSyncAt).toLocaleString(undefined, {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              )}
            </div>
            {reconnectUrl ? (
              <Button size="sm" variant="outline" asChild>
                <a href={reconnectUrl}>Reconnect</a>
              </Button>
            ) : null}
          </div>
        ) : (
          <Button
            size="sm"
            disabled={loading || comingSoon}
            asChild={!comingSoon}
          >
            {comingSoon ? (
              <span>Coming soon</span>
            ) : (
              <a href={connectUrl}>Connect {name}</a>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function WritingStyleSection() {
  const [style, setStyle] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("writing_style_notes")
        .eq("id", user.id)
        .single();

      setStyle(data?.writing_style_notes ?? "");
      setLoaded(true);
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ writing_style_notes: style || null })
      .eq("id", user.id);

    setSaving(false);
    if (error) {
      toast.error("Failed to save writing style");
    } else {
      toast.success("Writing style saved");
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Writing Style
      </h2>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Draft Preferences</CardTitle>
          <CardDescription className="mt-0.5">
            Tell Zoe how you write. She&apos;ll match your style when drafting
            replies and follow-ups.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loaded ? (
            <>
              <Textarea
                placeholder="e.g., I'm direct and concise. I rarely use exclamation marks. I sign off with just my first name. I prefer bullet points over long paragraphs."
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="min-h-[100px] resize-none text-sm"
                maxLength={500}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {style.length}/500
                </span>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </>
          ) : (
            <div className="h-[100px] animate-pulse rounded-md bg-muted" />
          )}
        </CardContent>
      </Card>
    </section>
  );
}

const themeOptions = [
  { value: "light" as const, label: "Light" },
  { value: "dark" as const, label: "Dark" },
  { value: "system" as const, label: "System" },
];

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const [userId, setUserId] = useState<string | null>(null);
  const mounted = theme !== undefined;

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
    }
    loadUser();
  }, []);

  async function handleThemeChange(value: "light" | "dark" | "system") {
    setTheme(value);
    if (!userId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ theme: value })
      .eq("id", userId);
    if (error) console.error("Failed to persist theme:", error);
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Appearance
      </h2>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Theme</CardTitle>
          <CardDescription className="mt-0.5">
            Choose how Zoe looks to you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mounted ? (
            <div className="flex gap-2">
              {themeOptions.map((opt) => (
                <Button
                  key={opt.value}
                  size="sm"
                  variant={theme === opt.value ? "default" : "outline"}
                  onClick={() => handleThemeChange(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex gap-2">
              {themeOptions.map((opt) => (
                <Button key={opt.value} size="sm" variant="outline" disabled>
                  {opt.label}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

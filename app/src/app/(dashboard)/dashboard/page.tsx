"use client";

import { RealityBriefSection } from "@/components/dashboard/reality-brief";
import { BehavioralSnapshotSection } from "@/components/dashboard/behavioral-snapshot";
import { InterventionsSection } from "@/components/dashboard/interventions";
import { ConnectionBanner } from "@/components/dashboard/connection-banner";
import { MeetingsAtRiskSection } from "@/components/dashboard/meetings-at-risk";
import { useDashboard } from "@/hooks/use-dashboard";
import { useHasConnection } from "@/hooks/use-connections";


export default function DashboardPage() {
  const { data, isLoading, isError } = useDashboard();
  const hasCalendar = useHasConnection("google");
  const hasSlack = useHasConnection("slack");

  const dashboardData = data ?? null;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">
          {dashboardData?.greeting ?? "Good morning"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s what your day actually looks like.
        </p>
      </div>

      {isError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load dashboard data. Please try refreshing the page.
        </div>
      )}

      {/* Connection Banner */}
      <ConnectionBanner
        hasCalendar={hasCalendar}
        hasEmail={hasCalendar} // Gmail uses same Google connection
        hasSlack={hasSlack}
      />

      {/* Section 1: Today's Reality Brief */}
      <RealityBriefSection
        data={dashboardData?.realityBrief ?? null}
        loading={isLoading}
        hasCalendar={hasCalendar}
        hasSlack={hasSlack}
        hasEmail={hasCalendar}
      />

      <MeetingsAtRiskSection hasCalendar={hasCalendar} />

      {/* Section 2: Behavioral Snapshot */}
      <BehavioralSnapshotSection
        data={dashboardData?.behavioralSnapshot ?? null}
        suggestions={dashboardData?.suggestions}
        loading={isLoading}
        hasIntegrations={hasCalendar || hasSlack}
      />

      {/* Section 3: Intervention Suggestions */}
      <InterventionsSection
        interventions={dashboardData?.interventions ?? []}
        loading={isLoading}
      />
    </div>
  );
}

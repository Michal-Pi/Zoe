// Deterministic activity creation from classified signals.
// Replaces the Sonnet generateObject call with a formula-based approach
// using the same scoring weights: urgency(30%) + importance(30%) + effort(20%) + strategic_alignment(20%).

interface ClassifiedSignal {
  id: string;
  source: string;
  source_type: string;
  title: string | null;
  snippet: string | null;
  sender_name: string | null;
  sender_email: string | null;
  urgency_score: number | null;
  ownership_signal: string | null;
  requires_response: boolean | null;
  escalation_level: string | null;
  topic_cluster: string | null;
  received_at: string;
}

interface WorkObjectInput {
  id: string;
  title: string;
  description: string | null;
  sourceKey: string | null;
  signals: ClassifiedSignal[];
}

export interface DeterministicActivity {
  title: string;
  description: string | null;
  time_estimate_minutes: number;
  horizon: "now" | "soon" | "strategic";
  trigger_description: string | null;
  deadline_at: string | null;
  score: number;
  score_rationale: string[];
  scoring_factors: {
    urgency: number;
    importance: number;
    effort: number;
    strategic_alignment: number;
  };
  batch_key: string | null;
  batch_label: string | null;
  work_object_id: string;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function computeUrgency(signals: ClassifiedSignal[]): number {
  if (!signals.length) return 0;

  // Use the max urgency score from the signals
  const maxUrgency = Math.max(
    ...signals.map((s) => s.urgency_score ?? 0)
  );

  // Boost for escalation
  const hasHighEscalation = signals.some(
    (s) => s.escalation_level === "high"
  );
  const hasMildEscalation = signals.some(
    (s) => s.escalation_level === "mild"
  );

  let urgency = maxUrgency;
  if (hasHighEscalation) urgency = Math.max(urgency, 80);
  if (hasMildEscalation) urgency = Math.max(urgency, 55);

  return clamp(urgency, 0, 100);
}

function computeImportance(
  signals: ClassifiedSignal[],
  priorityKeywords: string[]
): number {
  let importance = 30; // baseline

  // Ownership boost — owner > contributor > observer
  const hasOwner = signals.some((s) => s.ownership_signal === "owner");
  const hasContributor = signals.some(
    (s) => s.ownership_signal === "contributor"
  );
  if (hasOwner) importance += 30;
  else if (hasContributor) importance += 15;

  // Requires response boost
  const needsResponse = signals.some((s) => s.requires_response === true);
  if (needsResponse) importance += 15;

  // Multiple signals in the work object = more activity = more important
  if (signals.length >= 3) importance += 10;
  else if (signals.length >= 2) importance += 5;

  return clamp(importance, 0, 100);
}

function computeEffort(signals: ClassifiedSignal[]): number {
  // Effort is inverse — high score = quick win
  // Email replies are quick, multi-signal threads take longer
  const signalCount = signals.length;

  if (signalCount <= 1) return 80; // quick task
  if (signalCount <= 3) return 60; // moderate
  if (signalCount <= 5) return 40; // involved
  return 25; // large effort
}

function computeStrategicAlignment(
  signals: ClassifiedSignal[],
  priorityKeywords: string[]
): number {
  if (!priorityKeywords.length) return 50; // neutral if no priorities set

  const textToMatch = signals
    .map(
      (s) =>
        `${s.title ?? ""} ${s.snippet ?? ""} ${s.topic_cluster ?? ""}`
    )
    .join(" ")
    .toLowerCase();

  let matches = 0;
  for (const keyword of priorityKeywords) {
    const words = keyword.toLowerCase().split(/\s+/);
    if (words.some((word) => word.length > 3 && textToMatch.includes(word))) {
      matches++;
    }
  }

  if (matches === 0) return 20;
  if (matches === 1) return 55;
  if (matches === 2) return 75;
  return 90;
}

function computeHorizon(
  urgency: number,
  signals: ClassifiedSignal[]
): "now" | "soon" | "strategic" {
  const hasHighEscalation = signals.some(
    (s) => s.escalation_level === "high"
  );

  if (urgency >= 70 || hasHighEscalation) return "now";
  if (urgency >= 40) return "soon";
  return "strategic";
}

function estimateMinutes(signals: ClassifiedSignal[]): number {
  const needsResponse = signals.some((s) => s.requires_response);
  const isEmail = signals.some((s) => s.source === "gmail");
  const isSlack = signals.some((s) => s.source === "slack");
  const signalCount = signals.length;

  if (isEmail && needsResponse && signalCount <= 2) return 10;
  if (isSlack && needsResponse && signalCount <= 2) return 5;
  if (signalCount <= 1) return 10;
  if (signalCount <= 3) return 20;
  return 30;
}

function buildActivityTitle(
  wo: WorkObjectInput,
  signals: ClassifiedSignal[]
): string {
  const needsResponse = signals.some((s) => s.requires_response);
  const isEmail = signals.some((s) => s.source === "gmail");
  const isSlack = signals.some((s) => s.source === "slack");
  const latestSignal = [...signals].sort(
    (a, b) =>
      new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
  )[0];
  const sender = latestSignal?.sender_name ?? latestSignal?.sender_email;

  if (needsResponse && isEmail && sender) {
    const subject = latestSignal?.title?.replace(/^(Re|Fwd):\s*/i, "").trim();
    return subject
      ? `Reply to ${sender} re: ${subject}`
      : `Reply to email from ${sender}`;
  }

  if (needsResponse && isSlack && sender) {
    return `Respond to ${sender} on Slack`;
  }

  if (needsResponse && sender) {
    return `Respond to ${sender}`;
  }

  // Fall back to work object title
  return `Review: ${wo.title}`;
}

function buildTriggerDescription(signals: ClassifiedSignal[]): string | null {
  const latestSignal = [...signals].sort(
    (a, b) =>
      new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
  )[0];

  if (!latestSignal) return null;

  const source = latestSignal.source === "gmail" ? "Email" : "Message";
  const sender = latestSignal.sender_name ?? latestSignal.sender_email ?? "someone";
  const subject = latestSignal.title;

  if (subject) return `${source} from ${sender}: "${subject}"`;
  return `${source} from ${sender}`;
}

function buildScoreRationale(
  factors: DeterministicActivity["scoring_factors"],
  signals: ClassifiedSignal[]
): string[] {
  const rationale: string[] = [];

  if (factors.urgency >= 70) rationale.push("High urgency");
  const hasHighEscalation = signals.some(
    (s) => s.escalation_level === "high"
  );
  if (hasHighEscalation) rationale.push("Escalated");

  const needsResponse = signals.some((s) => s.requires_response);
  if (needsResponse) rationale.push("Needs reply");

  const hasOwner = signals.some((s) => s.ownership_signal === "owner");
  if (hasOwner) rationale.push("You own this");

  if (factors.strategic_alignment >= 70) rationale.push("Aligns with priorities");

  if (factors.effort >= 70) rationale.push("Quick win");

  if (!rationale.length) rationale.push("Regular work item");

  return rationale.slice(0, 3);
}

function shouldBatch(
  signals: ClassifiedSignal[],
  estimatedMinutes: number
): { batch_key: string | null; batch_label: string | null } {
  if (estimatedMinutes > 15) return { batch_key: null, batch_label: null };

  const isEmail = signals.every((s) => s.source === "gmail");
  const isSlack = signals.every((s) => s.source === "slack");
  const needsResponse = signals.some((s) => s.requires_response);

  if (isEmail && needsResponse) {
    return { batch_key: "email-replies", batch_label: "Email Replies" };
  }
  if (isSlack && needsResponse) {
    return { batch_key: "slack-catchup", batch_label: "Slack Catch-up" };
  }

  return { batch_key: null, batch_label: null };
}

export function createActivitiesFromWorkObjects(
  workObjects: WorkObjectInput[],
  priorityTitles: string[]
): DeterministicActivity[] {
  const activities: DeterministicActivity[] = [];

  for (const wo of workObjects) {
    if (!wo.signals.length) continue;

    const urgency = computeUrgency(wo.signals);
    const importance = computeImportance(wo.signals, priorityTitles);
    const effort = computeEffort(wo.signals);
    const strategicAlignment = computeStrategicAlignment(
      wo.signals,
      priorityTitles
    );

    // Same formula from the extraction prompt:
    // urgency(30%) + importance(30%) + effort(20%) + strategic_alignment(20%)
    const score = clamp(
      Math.round(
        urgency * 0.3 +
          importance * 0.3 +
          effort * 0.2 +
          strategicAlignment * 0.2
      ),
      0,
      100
    );

    const horizon = computeHorizon(urgency, wo.signals);
    const timeEstimate = estimateMinutes(wo.signals);
    const { batch_key, batch_label } = shouldBatch(wo.signals, timeEstimate);

    const factors = {
      urgency,
      importance,
      effort,
      strategic_alignment: strategicAlignment,
    };

    activities.push({
      title: buildActivityTitle(wo, wo.signals),
      description: wo.description,
      time_estimate_minutes: timeEstimate,
      horizon,
      trigger_description: buildTriggerDescription(wo.signals),
      deadline_at: null,
      score,
      score_rationale: buildScoreRationale(factors, wo.signals),
      scoring_factors: factors,
      batch_key,
      batch_label,
      work_object_id: wo.id,
    });
  }

  return activities;
}

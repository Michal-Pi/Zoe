// Heuristic signal classifier — deterministic classification without LLM.
// Produces the same output shape as the LLM classifier. Signals that score
// high confidence (>= CONFIDENCE_THRESHOLD) skip Haiku entirely.

export const CONFIDENCE_THRESHOLD = 0.85;

interface SignalInput {
  id: string;
  source: string;
  source_type: string;
  title: string | null;
  snippet: string | null;
  sender_name: string | null;
  sender_email: string | null;
  received_at: string;
  labels: string[] | null;
}

export interface HeuristicResult {
  signal_id: string;
  urgency_score: number;
  topic_cluster: string;
  ownership_signal: "owner" | "contributor" | "observer";
  requires_response: boolean;
  escalation_level: "none" | "mild" | "high";
  confidence: number;
}

// ── Sender patterns ──────────────────────────────────────────────

const NOREPLY_PATTERNS = [
  /^no-?reply@/i,
  /^noreply@/i,
  /^do-?not-?reply@/i,
  /^mailer-daemon@/i,
  /^postmaster@/i,
  /^notifications?@/i,
  /^alert[s]?@/i,
  /^digest@/i,
];

const NEWSLETTER_SENDER_PATTERNS = [
  /newsletter@/i,
  /news@/i,
  /marketing@/i,
  /promo(tions)?@/i,
  /campaign@/i,
  /updates?@/i,
  /info@/i,
  /hello@/i,
  /team@.*\.(io|com|co)$/i,
];

const AUTOMATED_SENDER_PATTERNS = [
  /^(jira|confluence|github|gitlab|bitbucket|linear|notion|asana|trello|slack|figma)/i,
  /^(sentry|datadog|pagerduty|opsgenie|grafana)/i,
  /^(stripe|paypal|square|braintree)/i,
  /^(aws|gcp|azure|vercel|netlify|heroku|cloudflare)/i,
  /calendar-notification@google/i,
  /noreply@.*google/i,
];

type SenderType = "noreply" | "newsletter" | "automated" | "human";

function classifySender(email: string | null): SenderType {
  if (!email) return "human";
  if (NOREPLY_PATTERNS.some((p) => p.test(email))) return "noreply";
  if (NEWSLETTER_SENDER_PATTERNS.some((p) => p.test(email))) return "newsletter";
  if (AUTOMATED_SENDER_PATTERNS.some((p) => p.test(email))) return "automated";
  return "human";
}

// ── Text pattern detection ───────────────────────────────────────

const DEADLINE_PATTERNS = [
  /\bby (today|tomorrow|end of day|eod|end of week|eow|friday|monday)\b/i,
  /\bdeadline\b/i,
  /\bdue (by|on|date)\b/i,
  /\basap\b/i,
  /\burgent(ly)?\b/i,
  /\btime[- ]?sensitive\b/i,
];

const QUESTION_PATTERNS = [
  /\?\s*$/m,
  /\bcan you\b/i,
  /\bcould you\b/i,
  /\bwould you\b/i,
  /\bplease (review|confirm|approve|send|check|update|let me know)\b/i,
  /\bwhat do you think\b/i,
  /\bthoughts\?/i,
  /\bwhat('s| is) your\b/i,
];

const FOLLOWUP_PATTERNS = [
  /\bfollowing up\b/i,
  /\bjust checking\b/i,
  /\bany update\b/i,
  /\breminder\b/i,
  /\bbumping this\b/i,
  /\bcircling back\b/i,
  /\bstill waiting\b/i,
  /\bhaven'?t heard\b/i,
  /\bping(ing)?\b/i,
];

const ESCALATION_PATTERNS = [
  /\bescalat(e|ing|ion)\b/i,
  /\bblocking\b/i,
  /\bblocked\b/i,
  /\bcritical\b/i,
  /\bp0\b/i,
  /\bsev[- ]?[01]\b/i,
  /\bimmediate(ly)?\b/i,
  /\bexecutive\b/i,
  /\bceo|cto|cfo|vp\b/i,
];

const MARKETING_PATTERNS = [
  /\bunsubscribe\b/i,
  /\bopt[- ]?out\b/i,
  /\bview in browser\b/i,
  /\bemail preferences\b/i,
  /\b(limited|exclusive) offer\b/i,
  /\b\d+% off\b/i,
  /\bfree trial\b/i,
  /\bpromo(tion)? code\b/i,
];

const AUTOMATED_TEXT_PATTERNS = [
  /\bThis is an automated\b/i,
  /\bDo not reply to this\b/i,
  /\bautomatically generated\b/i,
  /\bnotification from\b/i,
  /\bhas been (created|updated|merged|closed|assigned|completed|deployed)\b/i,
  /\bpull request\b/i,
  /\bcommit [a-f0-9]{7}/i,
  /\bbuild (succeeded|failed|passing)\b/i,
  /\bpipeline\b/i,
];

interface TextFeatures {
  hasDeadline: boolean;
  hasQuestion: boolean;
  hasFollowup: boolean;
  hasEscalation: boolean;
  hasMarketing: boolean;
  hasAutomatedText: boolean;
}

function extractTextFeatures(
  title: string | null,
  snippet: string | null
): TextFeatures {
  const text = `${title ?? ""} ${snippet ?? ""}`;
  return {
    hasDeadline: DEADLINE_PATTERNS.some((p) => p.test(text)),
    hasQuestion: QUESTION_PATTERNS.some((p) => p.test(text)),
    hasFollowup: FOLLOWUP_PATTERNS.some((p) => p.test(text)),
    hasEscalation: ESCALATION_PATTERNS.some((p) => p.test(text)),
    hasMarketing: MARKETING_PATTERNS.some((p) => p.test(text)),
    hasAutomatedText: AUTOMATED_TEXT_PATTERNS.some((p) => p.test(text)),
  };
}

// ── Label features ───────────────────────────────────────────────

interface LabelFeatures {
  isPromotions: boolean;
  isSocial: boolean;
  isUpdates: boolean;
  isForums: boolean;
  isStarred: boolean;
  isImportant: boolean;
}

function extractLabelFeatures(labels: string[] | null): LabelFeatures {
  const set = new Set((labels ?? []).map((l) => l.toLowerCase()));
  return {
    isPromotions: set.has("promotions") || set.has("category_promotions"),
    isSocial: set.has("social") || set.has("category_social"),
    isUpdates: set.has("updates") || set.has("category_updates"),
    isForums: set.has("forums") || set.has("category_forums"),
    isStarred: set.has("starred"),
    isImportant: set.has("important"),
  };
}

// ── Topic cluster extraction ─────────────────────────────────────

function extractTopicCluster(
  title: string | null,
  snippet: string | null,
  senderType: SenderType
): string {
  if (senderType === "newsletter") return "Newsletter";
  if (senderType === "automated") return "Notification";
  if (senderType === "noreply") return "Automated";

  // Try to derive from subject line
  const subject = (title ?? "").replace(/^(Re|Fwd|Fw):\s*/gi, "").trim();

  // Common patterns
  if (/\bmeeting\b|\bcall\b|\bsync\b|\bstandup\b/i.test(subject))
    return "Meeting";
  if (/\breview\b|\bpr\b|\bpull request\b|\bfeedback\b/i.test(subject))
    return "Review";
  if (/\binvoice\b|\bpayment\b|\bbilling\b|\breceipt\b/i.test(subject))
    return "Billing";
  if (/\bonboard\b|\bwelcome\b|\bgetting started\b/i.test(subject))
    return "Onboarding";
  if (/\bincident\b|\boutage\b|\bdown\b|\balert\b/i.test(subject))
    return "Incident";
  if (/\bhiring\b|\bcandidate\b|\binterview\b|\brecruit/i.test(subject))
    return "Recruiting";
  if (/\bcontract\b|\blegal\b|\bnda\b|\bagreement\b/i.test(subject))
    return "Legal";
  if (/\bproject\b|\broadmap\b|\bplanning\b|\bstrategy\b/i.test(subject))
    return "Planning";

  // Use first meaningful words of subject
  if (subject.length > 3) {
    return subject.slice(0, 40);
  }

  return "General";
}

// ── Main classifier ──────────────────────────────────────────────

export function classifyWithHeuristics(
  signal: SignalInput,
  priorityKeywords: string[]
): HeuristicResult {
  const senderType = classifySender(signal.sender_email);
  const textFeatures = extractTextFeatures(signal.title, signal.snippet);
  const labelFeatures = extractLabelFeatures(signal.labels);
  const topicCluster = extractTopicCluster(
    signal.title,
    signal.snippet,
    senderType
  );

  // ── Determine ownership ──
  let ownership: "owner" | "contributor" | "observer" = "observer";
  if (senderType === "human") {
    if (textFeatures.hasQuestion || textFeatures.hasFollowup) {
      ownership = "owner"; // someone is asking YOU
    } else {
      ownership = "contributor"; // human email, you're involved
    }
  }

  // ── Determine requires_response ──
  let requiresResponse = false;
  if (senderType === "human") {
    requiresResponse =
      textFeatures.hasQuestion ||
      textFeatures.hasFollowup ||
      textFeatures.hasDeadline;
  }

  // ── Determine escalation ──
  let escalation: "none" | "mild" | "high" = "none";
  if (textFeatures.hasEscalation) escalation = "high";
  else if (textFeatures.hasFollowup) escalation = "mild";
  else if (textFeatures.hasDeadline) escalation = "mild";

  // ── Compute urgency score ──
  let urgency = 30; // baseline for human mail

  // Non-human senders: very low urgency
  if (senderType === "noreply" || senderType === "newsletter") urgency = 5;
  else if (senderType === "automated") urgency = 15;

  // Gmail category-based
  if (labelFeatures.isPromotions || labelFeatures.isSocial) urgency = 5;
  else if (labelFeatures.isUpdates || labelFeatures.isForums) urgency = 15;

  // Text-based boosts (only for human senders)
  if (senderType === "human") {
    if (textFeatures.hasEscalation) urgency = Math.max(urgency, 85);
    else if (textFeatures.hasDeadline) urgency = Math.max(urgency, 70);
    else if (textFeatures.hasFollowup) urgency = Math.max(urgency, 55);
    else if (textFeatures.hasQuestion) urgency = Math.max(urgency, 45);
    if (labelFeatures.isStarred) urgency = Math.min(urgency + 10, 100);
    if (labelFeatures.isImportant) urgency = Math.min(urgency + 5, 100);
  }

  // Marketing text is low regardless
  if (textFeatures.hasMarketing) urgency = Math.min(urgency, 10);
  if (textFeatures.hasAutomatedText) urgency = Math.min(urgency, 20);

  urgency = Math.max(0, Math.min(100, Math.round(urgency)));

  // ── Compute confidence ──
  // High confidence = we're very sure about the classification
  let confidence = 0.5; // baseline

  // Very high confidence cases: clear non-human signals
  if (senderType === "noreply" || senderType === "newsletter") {
    confidence = 0.95;
  } else if (senderType === "automated") {
    confidence = 0.90;
  } else if (labelFeatures.isPromotions || labelFeatures.isSocial) {
    confidence = 0.92;
  } else if (textFeatures.hasMarketing) {
    confidence = 0.90;
  } else if (textFeatures.hasAutomatedText) {
    confidence = 0.88;
  }
  // High confidence: strong text signals from humans
  else if (textFeatures.hasEscalation) {
    confidence = 0.87;
  } else if (textFeatures.hasDeadline && textFeatures.hasQuestion) {
    confidence = 0.86;
  }
  // Medium confidence: some signals but ambiguous
  else if (textFeatures.hasQuestion || textFeatures.hasFollowup) {
    confidence = 0.70; // needs LLM for nuance
  }
  // Low confidence: plain human email, no strong signals
  else if (senderType === "human") {
    confidence = 0.50; // definitely needs LLM
  }

  // Slack messages are generally lower confidence for heuristics
  if (signal.source === "slack") {
    confidence = Math.min(confidence, 0.65);
  }

  return {
    signal_id: signal.id,
    urgency_score: urgency,
    topic_cluster: topicCluster,
    ownership_signal: ownership,
    requires_response: requiresResponse,
    escalation_level: escalation,
    confidence,
  };
}

/** Classify a batch and split into high-confidence (skip LLM) and low-confidence (need LLM) */
export function classifyBatchWithHeuristics(
  signals: SignalInput[],
  priorityKeywords: string[]
): {
  accepted: HeuristicResult[];
  needsLLM: SignalInput[];
} {
  const accepted: HeuristicResult[] = [];
  const needsLLM: SignalInput[] = [];

  for (const signal of signals) {
    const result = classifyWithHeuristics(signal, priorityKeywords);
    if (result.confidence >= CONFIDENCE_THRESHOLD) {
      accepted.push(result);
    } else {
      needsLLM.push(signal);
    }
  }

  return { accepted, needsLLM };
}

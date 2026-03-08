interface SignalForClustering {
  id: string;
  source: string;
  sourceType: string;
  title: string | null;
  snippet: string | null;
  senderName: string | null;
  senderEmail: string | null;
  topicCluster: string | null;
  urgencyScore: number | null;
  ownershipSignal: string | null;
  requiresResponse: boolean | null;
  receivedAt: string;
}

export function buildClusterPrompt(
  signals: SignalForClustering[],
  existingWorkObjects: { id: string; title: string }[]
): string {
  const existingSection =
    existingWorkObjects.length > 0
      ? `Existing active work objects (merge into these if the signals are related):\n${existingWorkObjects.map((wo) => `- [${wo.id}] ${wo.title}`).join("\n")}\n\nPrefer merging into existing work objects over creating new ones.`
      : "No existing work objects.";

  const signalsSection = signals
    .map(
      (s) =>
        `[${s.id}] Source: ${s.source} (${s.sourceType})
Title: ${s.title ?? "(none)"}
From: ${s.senderName ?? "Unknown"} <${s.senderEmail ?? "unknown"}>
Topic: ${s.topicCluster ?? "unclassified"}
Urgency: ${s.urgencyScore ?? "?"}/100 | Ownership: ${s.ownershipSignal ?? "?"} | Needs reply: ${s.requiresResponse ?? "?"}
Received: ${s.receivedAt}
Snippet: ${s.snippet ?? "(empty)"}`
    )
    .join("\n\n---\n\n");

  return `You are Zoe, a personal assistant that organizes incoming signals into coherent work objects (threads of related work).

${existingSection}

Group the following classified signals into work objects. Each work object represents a distinct thread of work, project, or conversation topic.

Rules:
- Signals from the same email thread or about the same topic belong together.
- A work object should have a clear, descriptive title.
- Each signal must belong to exactly one cluster.
- Prefer fewer, broader clusters over many tiny ones.
- If a signal clearly relates to an existing work object, include it in that cluster.

Signals to cluster:

${signalsSection}`;
}

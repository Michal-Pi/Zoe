// Deterministic signal clustering — replaces the Haiku generateObject call.
// Groups non-thread signals by their pre-assigned topic_cluster,
// then matches clusters to existing work objects by title similarity.

interface ClusterableSignal {
  id: string;
  source: string;
  source_type: string;
  title: string | null;
  snippet: string | null;
  sender_name: string | null;
  topic_cluster: string | null;
  received_at: string;
}

interface ExistingWorkObject {
  id: string;
  title: string;
}

export interface DeterministicCluster {
  title: string;
  description: string;
  signal_ids: string[];
  matched_work_object_id: string | null;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function titlesMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  // One contains the other
  if (na.length > 3 && nb.length > 3) {
    if (na.includes(nb) || nb.includes(na)) return true;
  }
  return false;
}

function buildClusterTitle(signals: ClusterableSignal[], topicCluster: string): string {
  // If the topic_cluster looks like a subject line (long), use it directly
  if (topicCluster.length > 5 && topicCluster !== "General") {
    return topicCluster;
  }

  // Otherwise try to derive from signal titles
  const titles = signals
    .map((s) => s.title?.replace(/^(Re|Fwd|Fw):\s*/gi, "").trim())
    .filter((t): t is string => Boolean(t && t.length > 3));

  if (titles.length > 0) {
    // Use the most common title, or the first one
    const titleCounts = new Map<string, number>();
    for (const t of titles) {
      const key = normalize(t);
      titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
    }
    const sorted = [...titleCounts.entries()].sort((a, b) => b[1] - a[1]);
    // Find the original-cased version of the most common title
    const bestKey = sorted[0][0];
    const bestTitle = titles.find((t) => normalize(t) === bestKey);
    return bestTitle ?? topicCluster;
  }

  return topicCluster;
}

function buildClusterDescription(
  signals: ClusterableSignal[],
  topicCluster: string
): string {
  const sources = [...new Set(signals.map((s) => s.source))];
  const sourceLabel = sources.join(", ");
  return `${signals.length} ${sourceLabel} signal${signals.length === 1 ? "" : "s"} related to ${topicCluster}.`;
}

export function clusterSignalsDeterministically(
  signals: ClusterableSignal[],
  existingWorkObjects: ExistingWorkObject[]
): DeterministicCluster[] {
  if (!signals.length) return [];

  // Group by topic_cluster
  const groups = new Map<string, ClusterableSignal[]>();
  for (const signal of signals) {
    const cluster = signal.topic_cluster?.trim() || "General";
    const existing = groups.get(cluster) ?? [];
    existing.push(signal);
    groups.set(cluster, existing);
  }

  const results: DeterministicCluster[] = [];

  for (const [topicCluster, groupSignals] of groups) {
    const title = buildClusterTitle(groupSignals, topicCluster);
    const description = buildClusterDescription(groupSignals, topicCluster);

    // Try to match to an existing work object
    const matchedWO = existingWorkObjects.find((wo) =>
      titlesMatch(wo.title, title) || titlesMatch(wo.title, topicCluster)
    );

    results.push({
      title: matchedWO ? matchedWO.title : title,
      description,
      signal_ids: groupSignals.map((s) => s.id),
      matched_work_object_id: matchedWO?.id ?? null,
    });
  }

  return results;
}

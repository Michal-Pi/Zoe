import { getValidAccessToken } from "./google-auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

// Gmail only accepts colors from a predefined palette.
// These are verified valid pairs.
const LABEL_DEFINITIONS = {
  respond_now: {
    name: "Zoe/Respond Now",
    color: { backgroundColor: "#fb4c2f", textColor: "#ffffff" },
  },
  to_reply: {
    name: "Zoe/To Reply",
    color: { backgroundColor: "#fad165", textColor: "#000000" },
  },
  you_own: {
    name: "Zoe/You Own This",
    color: { backgroundColor: "#a479e2", textColor: "#ffffff" },
  },
  fyi: {
    name: "Zoe/FYI",
    color: { backgroundColor: "#4a86e8", textColor: "#ffffff" },
  },
  escalation: {
    name: "Zoe/Escalation",
    color: { backgroundColor: "#fb4c2f", textColor: "#ffffff" },
  },
  processed: {
    name: "Zoe/Processed",
    color: { backgroundColor: "#c2c2c2", textColor: "#000000" },
  },
} as const;

type LabelKey = keyof typeof LABEL_DEFINITIONS;
type LabelIdMap = Record<LabelKey, string>;

interface GmailLabel {
  id: string;
  name: string;
  type: string;
}

/** Ensure all Zoe/* labels exist in the user's Gmail, return their IDs */
export async function ensureZoeLabels(
  connectionId: string
): Promise<LabelIdMap> {
  const accessToken = await getValidAccessToken(connectionId);

  // Fetch existing labels
  const listResponse = await fetch(
    `${GMAIL_API}/users/me/labels`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listResponse.ok) {
    throw new Error(`Gmail labels list error: ${listResponse.status}`);
  }

  const { labels: existingLabels } = (await listResponse.json()) as {
    labels: GmailLabel[];
  };

  const existingByName = new Map(
    existingLabels.map((l) => [l.name, l.id])
  );

  const labelIds: Partial<LabelIdMap> = {};

  for (const [key, definition] of Object.entries(LABEL_DEFINITIONS)) {
    const existing = existingByName.get(definition.name);
    if (existing) {
      labelIds[key as LabelKey] = existing;
      continue;
    }

    // Create the label
    const createResponse = await fetch(
      `${GMAIL_API}/users/me/labels`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: definition.name,
          messageListVisibility: "show",
          labelListVisibility: "labelShow",
          color: definition.color,
        }),
      }
    );

    if (!createResponse.ok) {
      console.error(
        `Failed to create label ${definition.name}: ${createResponse.status}`
      );
      continue;
    }

    const created = (await createResponse.json()) as GmailLabel;
    labelIds[key as LabelKey] = created.id;
  }

  return labelIds as LabelIdMap;
}

/** Determine which label key to apply based on signal classification */
export function classifyToLabelKey(classification: {
  urgencyScore: number | null;
  requiresResponse: boolean | null;
  ownershipSignal: string | null;
  escalationLevel: string | null;
}): LabelKey {
  if (classification.escalationLevel === "high") return "escalation";
  if (classification.requiresResponse && (classification.urgencyScore ?? 0) >= 70) return "respond_now";
  if (classification.requiresResponse) return "to_reply";
  if (classification.ownershipSignal === "owner") return "you_own";
  if (!classification.requiresResponse) return "fyi";
  return "processed";
}

/** Apply a Zoe label to a Gmail message, removing any other Zoe labels */
export async function applyZoeLabel(
  connectionId: string,
  messageExternalId: string,
  labelIds: LabelIdMap,
  targetKey: LabelKey
): Promise<void> {
  const accessToken = await getValidAccessToken(connectionId);

  // Remove all Zoe labels, add the correct one
  const allZoeLabelIds = Object.values(labelIds);
  const targetId = labelIds[targetKey];

  const removeLabelIds = allZoeLabelIds.filter((id) => id !== targetId);

  await fetch(
    `${GMAIL_API}/users/me/messages/${messageExternalId}/modify`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        addLabelIds: [targetId],
        removeLabelIds,
      }),
    }
  );
}

/** Batch apply labels to multiple messages (up to 1000 per call) */
export async function batchApplyZoeLabel(
  connectionId: string,
  messageExternalIds: string[],
  labelIds: LabelIdMap,
  targetKey: LabelKey
): Promise<void> {
  if (messageExternalIds.length === 0) return;

  const accessToken = await getValidAccessToken(connectionId);
  const targetId = labelIds[targetKey];

  // Process in chunks of 1000 (Gmail API limit)
  const chunkSize = 1000;
  for (let i = 0; i < messageExternalIds.length; i += chunkSize) {
    const chunk = messageExternalIds.slice(i, i + chunkSize);

    await fetch(
      `${GMAIL_API}/users/me/messages/batchModify`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: chunk,
          addLabelIds: [targetId],
        }),
      }
    );
  }
}

/** Store label IDs in connection metadata for reuse */
export async function cacheLabelIds(
  connectionId: string,
  labelIds: LabelIdMap
): Promise<void> {
  const supabase = await createServiceRoleClient();
  await supabase
    .from("integration_connections")
    .update({
      metadata: { gmail_labels: labelIds },
    })
    .eq("id", connectionId);
}

/** Load cached label IDs from connection metadata */
export async function getCachedLabelIds(
  connectionId: string
): Promise<LabelIdMap | null> {
  const supabase = await createServiceRoleClient();
  const { data } = await supabase
    .from("integration_connections")
    .select("metadata")
    .eq("id", connectionId)
    .single();

  const metadata = data?.metadata as Record<string, unknown> | null;
  if (metadata?.gmail_labels) {
    return metadata.gmail_labels as LabelIdMap;
  }
  return null;
}

/** Remove all Zoe/* labels from the user's Gmail (cleanup on disconnect) */
export async function removeZoeLabels(
  connectionId: string
): Promise<void> {
  const accessToken = await getValidAccessToken(connectionId);

  const listResponse = await fetch(
    `${GMAIL_API}/users/me/labels`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listResponse.ok) return;

  const { labels } = (await listResponse.json()) as {
    labels: GmailLabel[];
  };

  const zoeLabels = labels.filter((l) => l.name.startsWith("Zoe/"));

  for (const label of zoeLabels) {
    await fetch(
      `${GMAIL_API}/users/me/labels/${label.id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
  }
}

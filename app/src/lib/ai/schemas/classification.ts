import { z } from "zod";

export const signalClassificationSchema = z.object({
  urgency_score: z
    .number()
    .int()
    .describe("Urgency score 0-100. 100 = needs response within the hour."),
  topic_cluster: z
    .string()
    .describe(
      "Short topic label grouping related signals. E.g., 'Roadmap Planning', 'Legal Review', 'Team Standup'."
    ),
  ownership_signal: z
    .enum(["owner", "contributor", "observer"])
    .describe(
      "owner = user is responsible for outcome. contributor = user is actively involved. observer = user is CC'd or passively informed."
    ),
  requires_response: z
    .boolean()
    .describe("Whether this signal requires a response or action from the user."),
  escalation_level: z
    .enum(["none", "mild", "high"])
    .describe(
      "none = normal. mild = slightly urgent language or follow-up. high = explicit escalation, deadline pressure, or authority request."
    ),
});

export type SignalClassification = z.infer<typeof signalClassificationSchema>;

export const batchClassificationSchema = z.object({
  classifications: z.array(
    z.object({
      signal_id: z.string(),
      ...signalClassificationSchema.shape,
    })
  ),
});

export type BatchClassification = z.infer<typeof batchClassificationSchema>;

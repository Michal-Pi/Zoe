import { z } from "zod";

// NOTE: This schema is currently unused. Clustering was replaced by
// deterministic topic_cluster grouping in lib/scoring/deterministic-clustering.ts.
// Kept for potential reuse in Phase 6 (full-context review route).
export const clusterResultSchema = z.object({
  clusters: z.array(
    z.object({
      title: z
        .string()
        .describe(
          "Short, descriptive title for this work object. E.g., 'Q2 Roadmap Planning', 'Client Onboarding — Acme Corp'."
        ),
      description: z
        .string()
        .describe(
          "One-sentence description of what this work object is about."
        ),
      signal_ids: z
        .array(z.string())
        .describe("IDs of signals that belong to this cluster."),
    })
  ),
});

export type ClusterResult = z.infer<typeof clusterResultSchema>;

// NOTE: This schema is currently unused. Activity extraction was replaced by
// deterministic scoring in lib/scoring/deterministic-activities.ts (Phase 1).
// Kept for potential reuse in Phase 6 (full-context review route).
export const activityExtractionSchema = z.object({
  activities: z.array(
    z.object({
      title: z
        .string()
        .describe(
          "Clear, actionable title. Start with a verb. E.g., 'Reply to Sarah's budget question', 'Review PR #342'."
        ),
      description: z
        .string()
        .nullable()
        .describe("Brief context if needed."),
      time_estimate_minutes: z
        .number()
        .describe("Estimated time to complete in minutes."),
      horizon: z
        .enum(["now", "soon", "strategic"])
        .describe(
          "now = needs attention today. soon = this week. strategic = longer-term."
        ),
      trigger_description: z
        .string()
        .nullable()
        .describe(
          "What event triggered this activity. E.g., 'Email from Sarah asking for budget update'."
        ),
      deadline_at: z
        .string()
        .datetime({ offset: true })
        .nullable()
        .describe("ISO 8601 deadline if mentioned or implied. Null if none."),
      score: z
        .number()
        .describe("Priority score 0-100 based on the scoring factors."),
      score_rationale: z
        .array(z.string())
        .describe(
          "1-3 short reasons for the score. E.g., ['Blocking team', 'Due today', 'From VP']."
        ),
      scoring_factors: z
        .object({
          urgency: z.number(),
          importance: z.number(),
          effort: z.number(),
          strategic_alignment: z.number(),
        })
        .describe("Individual scoring dimensions."),
      batch_key: z
        .string()
        .nullable()
        .describe(
          "Group key for batchable activities. E.g., 'email-replies', 'slack-catchup'. Null if standalone."
        ),
      batch_label: z
        .string()
        .nullable()
        .describe(
          "Human-readable batch label. E.g., 'Email Replies', 'Slack Catch-up'."
        ),
    })
  ),
});

export type ActivityExtraction = z.infer<typeof activityExtractionSchema>;

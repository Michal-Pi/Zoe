import { describe, it, expect } from "vitest";
import { clusterResultSchema, activityExtractionSchema } from "./scoring";

describe("clusterResultSchema", () => {
  it("validates a valid cluster result", () => {
    const valid = {
      clusters: [
        {
          title: "Q2 Budget Planning",
          description: "All signals related to Q2 budget review",
          signal_ids: ["sig-1", "sig-2"],
        },
      ],
    };

    const result = clusterResultSchema.parse(valid);
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0].signal_ids).toEqual(["sig-1", "sig-2"]);
  });

  it("allows empty clusters array", () => {
    const result = clusterResultSchema.parse({ clusters: [] });
    expect(result.clusters).toHaveLength(0);
  });
});

describe("activityExtractionSchema", () => {
  it("validates a valid activity extraction", () => {
    const valid = {
      activities: [
        {
          title: "Reply to Sarah's budget question",
          description: "She needs the Q2 numbers by EOD",
          time_estimate_minutes: 15,
          horizon: "now",
          trigger_description: "Email from Sarah about Q2 budget",
          deadline_at: "2024-01-15T17:00:00Z",
          score: 85,
          score_rationale: ["Due today", "From VP", "Strategic alignment"],
          scoring_factors: {
            urgency: 90,
            importance: 80,
            effort: 90,
            strategic_alignment: 75,
          },
          batch_key: "email-replies",
          batch_label: "Email Replies",
        },
      ],
    };

    const result = activityExtractionSchema.parse(valid);
    expect(result.activities).toHaveLength(1);
    expect(result.activities[0].score).toBe(85);
  });

  it("rejects invalid horizon", () => {
    const invalid = {
      activities: [
        {
          title: "Test",
          description: null,
          time_estimate_minutes: 15,
          horizon: "later",
          trigger_description: null,
          deadline_at: null,
          score: 50,
          score_rationale: [],
          scoring_factors: {
            urgency: 50,
            importance: 50,
            effort: 50,
            strategic_alignment: 50,
          },
          batch_key: null,
          batch_label: null,
        },
      ],
    };

    expect(() => activityExtractionSchema.parse(invalid)).toThrow();
  });

  it("rejects score out of range", () => {
    const invalid = {
      activities: [
        {
          title: "Test",
          description: null,
          time_estimate_minutes: 15,
          horizon: "now",
          trigger_description: null,
          deadline_at: null,
          score: 150,
          score_rationale: [],
          scoring_factors: {
            urgency: 50,
            importance: 50,
            effort: 50,
            strategic_alignment: 50,
          },
          batch_key: null,
          batch_label: null,
        },
      ],
    };

    expect(() => activityExtractionSchema.parse(invalid)).toThrow();
  });
});

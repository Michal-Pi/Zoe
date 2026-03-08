import { describe, it, expect } from "vitest";
import {
  signalClassificationSchema,
  batchClassificationSchema,
} from "./classification";

describe("signalClassificationSchema", () => {
  it("validates a correct classification", () => {
    const valid = {
      urgency_score: 75,
      topic_cluster: "Budget Planning",
      ownership_signal: "owner",
      requires_response: true,
      escalation_level: "mild",
    };

    expect(signalClassificationSchema.parse(valid)).toEqual(valid);
  });

  it("rejects urgency_score out of range", () => {
    const invalid = {
      urgency_score: 150,
      topic_cluster: "Test",
      ownership_signal: "owner",
      requires_response: false,
      escalation_level: "none",
    };

    expect(() => signalClassificationSchema.parse(invalid)).toThrow();
  });

  it("rejects invalid ownership_signal", () => {
    const invalid = {
      urgency_score: 50,
      topic_cluster: "Test",
      ownership_signal: "boss",
      requires_response: false,
      escalation_level: "none",
    };

    expect(() => signalClassificationSchema.parse(invalid)).toThrow();
  });

  it("rejects invalid escalation_level", () => {
    const invalid = {
      urgency_score: 50,
      topic_cluster: "Test",
      ownership_signal: "observer",
      requires_response: false,
      escalation_level: "critical",
    };

    expect(() => signalClassificationSchema.parse(invalid)).toThrow();
  });
});

describe("batchClassificationSchema", () => {
  it("validates a batch of classifications", () => {
    const valid = {
      classifications: [
        {
          signal_id: "sig-1",
          urgency_score: 80,
          topic_cluster: "Engineering",
          ownership_signal: "contributor" as const,
          requires_response: true,
          escalation_level: "none" as const,
        },
        {
          signal_id: "sig-2",
          urgency_score: 20,
          topic_cluster: "Newsletters",
          ownership_signal: "observer" as const,
          requires_response: false,
          escalation_level: "none" as const,
        },
      ],
    };

    const result = batchClassificationSchema.parse(valid);
    expect(result.classifications).toHaveLength(2);
  });
});

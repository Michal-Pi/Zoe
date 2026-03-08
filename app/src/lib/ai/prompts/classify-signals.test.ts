import { describe, it, expect } from "vitest";
import { buildClassificationPrompt } from "./classify-signals";

describe("buildClassificationPrompt", () => {
  it("includes all signal fields in the prompt", () => {
    const signals = [
      {
        id: "sig-1",
        source: "gmail",
        sourceType: "email",
        title: "Budget Review",
        snippet: "Please review the Q2 budget",
        senderName: "Sarah Chen",
        senderEmail: "sarah@example.com",
        receivedAt: "2024-01-15T10:00:00Z",
        labels: ["inbox", "important"],
      },
    ];

    const result = buildClassificationPrompt(signals, ["Launch Q2 roadmap"]);

    expect(result).toContain("sig-1");
    expect(result).toContain("Budget Review");
    expect(result).toContain("Sarah Chen");
    expect(result).toContain("sarah@example.com");
    expect(result).toContain("inbox, important");
    expect(result).toContain("Launch Q2 roadmap");
  });

  it("handles signals with null fields", () => {
    const signals = [
      {
        id: "sig-2",
        source: "slack",
        sourceType: "slack_message",
        title: null,
        snippet: null,
        senderName: null,
        senderEmail: null,
        receivedAt: "2024-01-15T10:00:00Z",
        labels: null,
      },
    ];

    const result = buildClassificationPrompt(signals, []);

    expect(result).toContain("(none)");
    expect(result).toContain("Unknown");
    expect(result).toContain("(empty)");
    expect(result).toContain("none");
    expect(result).toContain("No strategic priorities set.");
  });

  it("includes scoring guidelines", () => {
    const result = buildClassificationPrompt([], []);

    expect(result).toContain("90-100");
    expect(result).toContain("urgency_score");
    expect(result).toContain("topic_cluster");
    expect(result).toContain("ownership_signal");
    expect(result).toContain("requires_response");
    expect(result).toContain("escalation_level");
  });

  it("numbers priorities correctly", () => {
    const result = buildClassificationPrompt(
      [],
      ["Priority A", "Priority B", "Priority C"]
    );

    expect(result).toContain("1. Priority A");
    expect(result).toContain("2. Priority B");
    expect(result).toContain("3. Priority C");
  });
});

import { describe, it, expect } from "vitest";
import { buildClusterPrompt } from "./cluster-signals";

describe("buildClusterPrompt", () => {
  it("includes signal details and existing work objects", () => {
    const signals = [
      {
        id: "sig-1",
        source: "gmail",
        sourceType: "email",
        title: "Q2 Budget Review",
        snippet: "Need your input on the budget",
        senderName: "Finance Team",
        senderEmail: "finance@example.com",
        topicCluster: "Budget Planning",
        urgencyScore: 75,
        ownershipSignal: "owner",
        requiresResponse: true,
        receivedAt: "2024-01-15T10:00:00Z",
      },
    ];

    const existingWOs = [{ id: "wo-1", title: "Q2 Planning" }];

    const result = buildClusterPrompt(signals, existingWOs);

    expect(result).toContain("sig-1");
    expect(result).toContain("Q2 Budget Review");
    expect(result).toContain("Budget Planning");
    expect(result).toContain("75/100");
    expect(result).toContain("[wo-1] Q2 Planning");
    expect(result).toContain("Prefer merging into existing work objects");
  });

  it("handles no existing work objects", () => {
    const result = buildClusterPrompt([], []);
    expect(result).toContain("No existing work objects.");
  });
});

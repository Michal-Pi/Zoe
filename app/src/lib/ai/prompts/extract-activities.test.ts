import { describe, it, expect } from "vitest";
import { buildActivityExtractionPrompt } from "./extract-activities";

describe("buildActivityExtractionPrompt", () => {
  it("includes work objects and priorities", () => {
    const workObjects = [
      {
        id: "wo-1",
        title: "Q2 Budget Review",
        description: "Annual budget planning process",
        signals: [
          {
            source: "gmail",
            sourceType: "email",
            title: "Budget numbers",
            snippet: "Please review attached",
            senderName: "CFO",
            urgencyScore: 80,
            ownershipSignal: "owner",
            requiresResponse: true,
            escalationLevel: "mild",
            receivedAt: "2024-01-15T10:00:00Z",
          },
        ],
      },
    ];

    const result = buildActivityExtractionPrompt(
      workObjects,
      ["Close Q2 financials"],
      "2024-01-15T14:00:00Z"
    );

    expect(result).toContain("Q2 Budget Review");
    expect(result).toContain("Close Q2 financials");
    expect(result).toContain("urgency(30%)");
    expect(result).toContain("importance(30%)");
    expect(result).toContain("effort(20%)");
    expect(result).toContain("strategic_alignment(20%)");
    expect(result).toContain("CFO");
  });

  it("handles no priorities", () => {
    const result = buildActivityExtractionPrompt([], [], "2024-01-15T14:00:00Z");
    expect(result).toContain("No strategic priorities set.");
  });
});

import { describe, it, expect } from "vitest";
import { buildFollowupPrompt } from "./generate-followup";

describe("buildFollowupPrompt", () => {
  const baseMeeting = {
    title: "Sprint Planning",
    description: "Bi-weekly sprint planning session",
    startAt: "2026-03-09T14:00:00Z",
    endAt: "2026-03-09T15:00:00Z",
    attendees: [
      { email: "sarah@co.com", name: "Sarah" },
      { email: "mike@co.com", name: "Mike" },
    ],
    attendeeCount: 3,
    decisionDensity: "high",
    ownershipLoad: "driver",
  };

  it("includes meeting title and time", () => {
    const prompt = buildFollowupPrompt(baseMeeting, [], null);

    expect(prompt).toContain("Sprint Planning");
    expect(prompt).toContain("2026-03-09T14:00:00Z");
    expect(prompt).toContain("2026-03-09T15:00:00Z");
  });

  it("lists attendees", () => {
    const prompt = buildFollowupPrompt(baseMeeting, [], null);

    expect(prompt).toContain("Sarah <sarah@co.com>");
    expect(prompt).toContain("Mike <mike@co.com>");
  });

  it("includes related signals when provided", () => {
    const prompt = buildFollowupPrompt(
      baseMeeting,
      [
        {
          title: "Budget update",
          snippet: "Q3 numbers are ready",
          senderName: "Sarah",
          topicCluster: "Finance",
          receivedAt: "2026-03-09T10:00:00Z",
        },
      ],
      null
    );

    expect(prompt).toContain("Budget update");
    expect(prompt).toContain("Finance");
    expect(prompt).toContain("Q3 numbers are ready");
  });

  it("adds placeholder note when no signals", () => {
    const prompt = buildFollowupPrompt(baseMeeting, [], null);

    expect(prompt).toContain("No related signals found");
    expect(prompt).toContain("placeholders");
  });

  it("includes writing style when provided", () => {
    const prompt = buildFollowupPrompt(
      baseMeeting,
      [],
      "Keep it brief, use bullet points."
    );

    expect(prompt).toContain("Keep it brief, use bullet points.");
  });

  it("handles null attendees", () => {
    const meeting = { ...baseMeeting, attendees: null };
    const prompt = buildFollowupPrompt(meeting, [], null);

    expect(prompt).toContain("No attendee details");
  });

  it("truncates long descriptions", () => {
    const meeting = {
      ...baseMeeting,
      description: "A".repeat(600),
    };
    const prompt = buildFollowupPrompt(meeting, [], null);

    // Description should be capped at 500 chars
    expect(prompt).toContain("A".repeat(500));
    expect(prompt).not.toContain("A".repeat(501));
  });
});

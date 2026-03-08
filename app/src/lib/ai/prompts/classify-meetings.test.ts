import { describe, it, expect } from "vitest";
import { buildMeetingClassificationPrompt } from "./classify-meetings";

describe("buildMeetingClassificationPrompt", () => {
  it("includes meeting details and user email", () => {
    const meetings = [
      {
        id: "evt-1",
        title: "Q2 Roadmap Review",
        description: "Review product roadmap for Q2",
        startAt: "2024-01-15T10:00:00Z",
        endAt: "2024-01-15T11:00:00Z",
        isOrganizer: true,
        attendeeCount: 8,
        isRecurring: false,
        location: "Zoom",
      },
    ];

    const result = buildMeetingClassificationPrompt(
      meetings,
      "user@example.com"
    );

    expect(result).toContain("evt-1");
    expect(result).toContain("Q2 Roadmap Review");
    expect(result).toContain("Organizer");
    expect(result).toContain("Attendees: 8");
    expect(result).toContain("Zoom");
    expect(result).toContain("user@example.com");
    expect(result).toContain("decision_density");
    expect(result).toContain("ownership_load");
    expect(result).toContain("efficiency_risks");
  });

  it("handles meetings without descriptions", () => {
    const meetings = [
      {
        id: "evt-2",
        title: "1:1 Sync",
        description: null,
        startAt: "2024-01-15T14:00:00Z",
        endAt: "2024-01-15T14:30:00Z",
        isOrganizer: false,
        attendeeCount: 2,
        isRecurring: true,
        location: null,
      },
    ];

    const result = buildMeetingClassificationPrompt(meetings, "me@test.com");

    expect(result).toContain("(no description)");
    expect(result).toContain("Attendee");
    expect(result).toContain("Recurring: Yes");
    expect(result).toContain("(none)");
  });
});

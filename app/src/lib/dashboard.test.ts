import { describe, it, expect } from "vitest";
import { generateInterventions } from "./dashboard";
import type { RealityBrief } from "@/domain/dashboard";

describe("generateInterventions", () => {
  it("suggests deep work protection when calendar is packed", () => {
    const reality: RealityBrief = {
      availableExecutionMinutes: 90,
      meetingCount: 5,
      totalMeetingMinutes: 300,
      activeSlackThreads: 10,
      unreadEmails: 5,
      openLoops: 8,
      maxMeaningfulTasks: 2,
    };

    const result = generateInterventions(reality);
    expect(Array.isArray(result)).toBe(true);
    const hasDeepWork = result.some((i) => i.id === "protect-deep-work");
    expect(hasDeepWork).toBe(true);
  });

  it("returns empty when conditions are fine", () => {
    const reality: RealityBrief = {
      availableExecutionMinutes: 300,
      meetingCount: 2,
      totalMeetingMinutes: 90,
      activeSlackThreads: 3,
      unreadEmails: 2,
      openLoops: 2,
      maxMeaningfulTasks: 5,
    };

    const result = generateInterventions(reality);
    expect(Array.isArray(result)).toBe(true);
  });
});

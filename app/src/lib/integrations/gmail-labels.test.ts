import { describe, it, expect } from "vitest";
import { classifyToLabelKey } from "./gmail-labels";

describe("classifyToLabelKey", () => {
  it("returns escalation for high escalation level", () => {
    expect(
      classifyToLabelKey({
        urgencyScore: 50,
        requiresResponse: true,
        ownershipSignal: null,
        escalationLevel: "high",
      })
    ).toBe("escalation");
  });

  it("returns respond_now for urgent emails requiring response", () => {
    expect(
      classifyToLabelKey({
        urgencyScore: 85,
        requiresResponse: true,
        ownershipSignal: null,
        escalationLevel: null,
      })
    ).toBe("respond_now");
  });

  it("returns to_reply for non-urgent emails requiring response", () => {
    expect(
      classifyToLabelKey({
        urgencyScore: 40,
        requiresResponse: true,
        ownershipSignal: null,
        escalationLevel: null,
      })
    ).toBe("to_reply");
  });

  it("returns you_own for ownership signals", () => {
    expect(
      classifyToLabelKey({
        urgencyScore: 30,
        requiresResponse: false,
        ownershipSignal: "owner",
        escalationLevel: null,
      })
    ).toBe("you_own");
  });

  it("returns fyi for non-response emails", () => {
    expect(
      classifyToLabelKey({
        urgencyScore: 20,
        requiresResponse: false,
        ownershipSignal: null,
        escalationLevel: null,
      })
    ).toBe("fyi");
  });

  it("escalation takes priority over respond_now", () => {
    expect(
      classifyToLabelKey({
        urgencyScore: 90,
        requiresResponse: true,
        ownershipSignal: "owner",
        escalationLevel: "high",
      })
    ).toBe("escalation");
  });

  it("respond_now requires urgency >= 70", () => {
    expect(
      classifyToLabelKey({
        urgencyScore: 69,
        requiresResponse: true,
        ownershipSignal: null,
        escalationLevel: null,
      })
    ).toBe("to_reply");

    expect(
      classifyToLabelKey({
        urgencyScore: 70,
        requiresResponse: true,
        ownershipSignal: null,
        escalationLevel: null,
      })
    ).toBe("respond_now");
  });

  it("handles null urgency score", () => {
    expect(
      classifyToLabelKey({
        urgencyScore: null,
        requiresResponse: true,
        ownershipSignal: null,
        escalationLevel: null,
      })
    ).toBe("to_reply");
  });
});

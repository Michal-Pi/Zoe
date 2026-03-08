import { describe, it, expect } from "vitest";
import { draftReplySchema, followUpDraftSchema } from "./draft-reply";

describe("draftReplySchema", () => {
  it("validates a correct draft reply", () => {
    const result = draftReplySchema.safeParse({
      subject: "Re: Budget Proposal",
      body: "Hi Sarah, thanks for sending this over. I've reviewed the numbers and have a few questions. Can we discuss tomorrow?",
      tone: "professional",
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing subject", () => {
    const result = draftReplySchema.safeParse({
      body: "Some body text",
      tone: "professional",
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid tone", () => {
    const result = draftReplySchema.safeParse({
      subject: "Re: Test",
      body: "Some text",
      tone: "angry",
    });

    expect(result.success).toBe(false);
  });

  it("accepts all valid tone values", () => {
    const tones = ["professional", "casual", "direct", "empathetic"] as const;
    for (const tone of tones) {
      const result = draftReplySchema.safeParse({
        subject: "Re: Test",
        body: "Some text",
        tone,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("followUpDraftSchema", () => {
  it("validates a correct follow-up draft", () => {
    const result = followUpDraftSchema.safeParse({
      subject: "Follow-up: Roadmap Sync",
      body: "Hi team, thanks for the discussion today. Here are the key takeaways and action items.",
      action_items: [
        {
          assignee: "sarah@company.com",
          action: "Update the timeline document",
          deadline: "2026-03-12",
        },
        {
          assignee: "Mike",
          action: "Review the budget numbers",
          deadline: null,
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("accepts empty action items array", () => {
    const result = followUpDraftSchema.safeParse({
      subject: "Follow-up: Standup",
      body: "Quick sync completed, no action items.",
      action_items: [],
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing body", () => {
    const result = followUpDraftSchema.safeParse({
      subject: "Follow-up: Meeting",
      action_items: [],
    });

    expect(result.success).toBe(false);
  });
});

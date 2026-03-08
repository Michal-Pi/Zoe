import { describe, it, expect } from "vitest";
import { buildDraftReplyPrompt } from "./generate-draft-reply";

describe("buildDraftReplyPrompt", () => {
  it("includes sender info and subject", () => {
    const prompt = buildDraftReplyPrompt(
      {
        senderName: "Sarah Chen",
        senderEmail: "sarah@example.com",
        subject: "Q3 Budget Review",
        snippet: "Please review the attached numbers",
        body: null,
        threadContext: null,
      },
      [],
      null
    );

    expect(prompt).toContain("Sarah Chen");
    expect(prompt).toContain("sarah@example.com");
    expect(prompt).toContain("Q3 Budget Review");
  });

  it("includes full body when available", () => {
    const prompt = buildDraftReplyPrompt(
      {
        senderName: null,
        senderEmail: "test@example.com",
        subject: "Test",
        snippet: "Short snippet",
        body: "This is the full email body with more detail.",
        threadContext: null,
      },
      [],
      null
    );

    expect(prompt).toContain("Full email body:");
    expect(prompt).toContain("full email body with more detail");
    expect(prompt).not.toContain("Email snippet:");
  });

  it("falls back to snippet when no body", () => {
    const prompt = buildDraftReplyPrompt(
      {
        senderName: null,
        senderEmail: "test@example.com",
        subject: "Test",
        snippet: "This is just the snippet",
        body: null,
        threadContext: null,
      },
      [],
      null
    );

    expect(prompt).toContain("Email snippet:");
    expect(prompt).toContain("just the snippet");
  });

  it("includes user priorities when provided", () => {
    const prompt = buildDraftReplyPrompt(
      {
        senderName: null,
        senderEmail: "test@example.com",
        subject: "Test",
        snippet: null,
        body: null,
        threadContext: null,
      },
      ["Ship v2.0 by March", "Hire senior engineer"],
      null
    );

    expect(prompt).toContain("Ship v2.0 by March");
    expect(prompt).toContain("Hire senior engineer");
  });

  it("includes writing style when provided", () => {
    const prompt = buildDraftReplyPrompt(
      {
        senderName: null,
        senderEmail: "test@example.com",
        subject: "Test",
        snippet: null,
        body: null,
        threadContext: null,
      },
      [],
      "Direct and concise. No exclamation marks."
    );

    expect(prompt).toContain("Direct and concise. No exclamation marks.");
  });

  it("includes thread context when provided", () => {
    const prompt = buildDraftReplyPrompt(
      {
        senderName: null,
        senderEmail: "test@example.com",
        subject: "Test",
        snippet: null,
        body: null,
        threadContext: "Previous message: Let's sync on the roadmap.",
      },
      [],
      null
    );

    expect(prompt).toContain("Previous messages in this thread:");
    expect(prompt).toContain("sync on the roadmap");
  });
});

import { describe, it, expect } from "vitest";
import { estimateCost } from "./llm-costs";

describe("estimateCost", () => {
  it("calculates Haiku costs correctly", () => {
    const cost = estimateCost({
      model: "claude-haiku-4-5-latest",
      operation: "classify",
      inputTokens: 1000,
      outputTokens: 200,
    });

    // 1000/1M * $0.80 + 200/1M * $4.00 = $0.0008 + $0.0008 = $0.0016
    expect(cost).toBeCloseTo(0.0016, 6);
  });

  it("calculates Sonnet costs correctly", () => {
    const cost = estimateCost({
      model: "claude-sonnet-4-6-latest",
      operation: "draft",
      inputTokens: 2000,
      outputTokens: 500,
    });

    // 2000/1M * $3.00 + 500/1M * $15.00 = $0.006 + $0.0075 = $0.0135
    expect(cost).toBeCloseTo(0.0135, 6);
  });

  it("returns 0 for unknown model", () => {
    const cost = estimateCost({
      model: "unknown-model",
      operation: "test",
      inputTokens: 1000,
      outputTokens: 1000,
    });

    expect(cost).toBe(0);
  });

  it("handles zero tokens", () => {
    const cost = estimateCost({
      model: "claude-haiku-4-5-latest",
      operation: "test",
      inputTokens: 0,
      outputTokens: 0,
    });

    expect(cost).toBe(0);
  });

  it("handles large token counts", () => {
    const cost = estimateCost({
      model: "claude-sonnet-4-6-latest",
      operation: "large_prompt",
      inputTokens: 100_000,
      outputTokens: 10_000,
    });

    // 100K/1M * $3.00 + 10K/1M * $15.00 = $0.30 + $0.15 = $0.45
    expect(cost).toBeCloseTo(0.45, 4);
  });
});

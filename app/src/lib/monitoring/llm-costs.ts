// LLM cost tracking — logs token usage for monitoring and budgeting

import { createServiceRoleClient } from "@/lib/supabase/server";

interface LLMUsage {
  model: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  userId?: string;
  metadata?: Record<string, unknown>;
}

// Approximate costs per 1M tokens (as of 2025)
const COSTS_PER_1M_TOKENS: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-latest": { input: 0.80, output: 4.00 },
  "claude-haiku-4-5-20251001": { input: 0.80, output: 4.00 },
  "claude-sonnet-4-6-latest": { input: 3.00, output: 15.00 },
  "claude-sonnet-4-6-20250514": { input: 3.00, output: 15.00 },
};

export function estimateCost(usage: LLMUsage): number {
  const rates = COSTS_PER_1M_TOKENS[usage.model];
  if (!rates) return 0;

  const inputCost = (usage.inputTokens / 1_000_000) * rates.input;
  const outputCost = (usage.outputTokens / 1_000_000) * rates.output;
  return inputCost + outputCost;
}

export function logLLMUsage(usage: LLMUsage) {
  const cost = estimateCost(usage);

  // Log to console in structured format for Vercel Logs
  console.log(
    JSON.stringify({
      type: "llm_usage",
      model: usage.model,
      operation: usage.operation,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      estimated_cost_usd: cost.toFixed(6),
      user_id: usage.userId,
      timestamp: new Date().toISOString(),
    })
  );

  // Persist to database (fire-and-forget, never block the caller)
  if (usage.userId) {
    persistUsage(usage, cost).catch((err) => {
      console.error("Failed to persist LLM usage:", err instanceof Error ? err.message : err);
    });
  }
}

async function persistUsage(usage: LLMUsage, cost: number): Promise<void> {
  const supabase = await createServiceRoleClient();
  await supabase.from("llm_usage").insert({
    user_id: usage.userId,
    operation: usage.operation,
    model: usage.model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    estimated_cost_usd: cost,
    metadata: usage.metadata ?? {},
  });
}

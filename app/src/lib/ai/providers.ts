import { anthropic } from "@ai-sdk/anthropic";

// Model tiers for different tasks
export const models = {
  /** Fast, cheap — signal classification, meeting classification */
  fast: anthropic("claude-3-5-haiku-20241022"),
  /** Capable — activity extraction, chat, drafting */
  standard: anthropic("claude-sonnet-4-20250514"),
} as const;

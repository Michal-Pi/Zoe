import { anthropic } from "@ai-sdk/anthropic";

// Model tiers for different tasks
export const models = {
  /** Fast, cheap — signal classification, meeting classification */
  fast: anthropic("claude-haiku-4-5"),
  /** Capable — activity extraction, chat, drafting */
  standard: anthropic("claude-sonnet-4-6"),
} as const;

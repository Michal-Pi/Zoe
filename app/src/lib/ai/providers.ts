import { anthropic } from "@ai-sdk/anthropic";

// Model tiers for different tasks
export const models = {
  /** Fast, cheap — signal classification, meeting classification */
  fast: anthropic("claude-3-haiku-20240307"),
  /** Capable — activity extraction, chat, drafting */
  standard: anthropic("claude-3-5-sonnet-20241022"),
} as const;

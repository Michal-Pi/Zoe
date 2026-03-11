import { anthropic } from "@ai-sdk/anthropic";

// Model tiers for different tasks
export const models = {
  /** Fast, cheap — signal classification, meeting classification */
  fast: anthropic("claude-3-haiku-20240307"),
  /** Use the proven available model until Sonnet access is confirmed */
  standard: anthropic("claude-3-haiku-20240307"),
} as const;

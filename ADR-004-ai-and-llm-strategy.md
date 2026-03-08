# ADR-004: AI/LLM Strategy

## Status: ACCEPTED

## Context

Zoe's intelligence layer powers: priority scoring, activity extraction, meeting classification, chat responses, draft generation, and behavioral analysis. LLM costs must stay under $3/user/month for sustainable unit economics at $15/month pricing.

## Decision

**Multi-model strategy with cost tiers, defaulting to fast/cheap models and escalating to capable models only when needed.**

### Model Allocation

| Task                                                     | Model      | Rationale                                                  | Est. Cost/User/Month |
| -------------------------------------------------------- | ---------- | ---------------------------------------------------------- | -------------------- |
| **Signal classification** (email/Slack triage)           | Haiku 4.5  | High volume, low complexity. ~200 classifications/day/user | $0.30                |
| **Activity extraction** (Work Object → Activities)       | Sonnet 4.6 | Needs reasoning + structured output                        | $0.50                |
| **Priority scoring** (0–100 + rationale)                 | Sonnet 4.6 | Scoring factors need nuanced judgment                      | $0.40                |
| **Meeting classification** (decision density, ownership) | Haiku 4.5  | Pattern matching with structured output                    | $0.10                |
| **Chat responses** (draft replies, briefs)               | Sonnet 4.6 | User-facing quality matters                                | $0.80                |
| **Behavioral analysis** (weekly trends)                  | Sonnet 4.6 | Complex analysis, runs 1x/week                             | $0.05                |
| **Calendar actions** (parse intent → API call)           | Haiku 4.5  | Tool use, structured extraction                            | $0.10                |
| **Intervention suggestions**                             | Haiku 4.5  | Template-driven, low variability                           | $0.05                |
| **Total**                                                |            |                                                            | **~$2.30**           |

### Provider Strategy

- **Primary:** Anthropic (Claude Haiku 4.5 + Sonnet 4.6) — best structured output, tool use, and instruction following
- **Fallback:** Google Gemini 3 Flash — for cost reduction if Anthropic pricing changes
- **No OpenAI dependency** in MVP — simplifies vendor management

### Architecture

- **Vercel AI SDK** as the abstraction layer — provider-agnostic streaming, structured output, tool calling
- **Prompt templates** stored in code (not database) — version-controlled, testable
- **Structured output** via Zod schemas for all LLM responses — type-safe, parseable
- **Caching layer:** Redis (Upstash) for deduplicating identical classification requests
- **Rate limiting:** Per-user token budgets with soft limits + admin alerts

### Reuse From LifeOS_2

- Provider service patterns (Anthropic, Google SDK integration)
- LangChain/LangGraph workflow orchestration concepts
- Tool calling patterns and result parsing
- Agent configuration types and templates

**Not reused:** LifeOS_2's complex multi-agent orchestration (dialectical, expert council, deep research). These are overkill for Zoe MVP. Simple prompt chains are sufficient.

## Trade-offs

- **No Opus/GPT-4-class models in the hot path.** Quality is slightly lower but cost is 10x less. Sonnet 4.6 is "good enough" for all Zoe tasks.
- **No real-time streaming for classification.** Batch processing every 60s is cheaper and simpler.
- **Prompt templates in code means no runtime editing.** Fine for MVP; can add admin UI later.

## Cost Controls

1. **Token budget per user:** 500K input + 100K output tokens/month (~$2.50 at Sonnet pricing)
2. **Batch classification:** Process signals in batches of 10–20 (one LLM call vs 20)
3. **Cache identical requests:** Same email thread re-classified → return cached result
4. **Degrade gracefully:** If budget exceeded, fall back to Haiku for all tasks
5. **Monitor per-user costs:** Alert if any user exceeds 2x average

## Consequences

- Anthropic API key required in production
- Upstash Redis for caching layer
- Cost monitoring dashboard needed (can use Anthropic's usage API)
- Prompt engineering is a first-class development activity (not an afterthought)

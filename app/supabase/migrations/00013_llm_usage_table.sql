-- Persistent LLM usage tracking for cost measurement and optimization.
-- Every AI call should log here so we can measure before/after improvements.

CREATE TABLE llm_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost_usd NUMERIC(10, 6),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own llm usage" ON llm_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX idx_llm_usage_user_created ON llm_usage(user_id, created_at DESC);
CREATE INDEX idx_llm_usage_operation ON llm_usage(operation, created_at DESC);

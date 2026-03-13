-- Triage experiment framework: config, assignment, and result storage.
-- Enables A/B/C routing with shadow runs for signal classification.

-- ── Experiment configs ──────────────────────────────────────────
CREATE TABLE triage_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  -- Arm weights as percentages (must sum to 100)
  arm_weights JSONB NOT NULL DEFAULT '{"A": 100, "B": 0, "C": 0}'::jsonb,
  -- Shadow config
  shadow_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  shadow_arm TEXT CHECK (shadow_arm IN ('A', 'B', 'C')),
  shadow_sample_rate NUMERIC(3, 2) NOT NULL DEFAULT 0.05
    CHECK (shadow_sample_rate >= 0 AND shadow_sample_rate <= 1),
  -- Versioning for stable assignment
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE triage_experiments ENABLE ROW LEVEL SECURITY;

-- ── Per-user arm overrides (for testing) ────────────────────────
CREATE TABLE triage_assignment_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES triage_experiments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  arm TEXT NOT NULL CHECK (arm IN ('A', 'B', 'C')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (experiment_id, user_id)
);

ALTER TABLE triage_assignment_overrides ENABLE ROW LEVEL SECURITY;

-- ── Cached assignment (written on first signal per experiment version) ──
CREATE TABLE triage_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES triage_experiments(id) ON DELETE CASCADE,
  experiment_version INTEGER NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  arm TEXT NOT NULL CHECK (arm IN ('A', 'B', 'C')),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (experiment_id, experiment_version, user_id)
);

ALTER TABLE triage_assignments ENABLE ROW LEVEL SECURITY;

-- ── Per-signal classification results ───────────────────────────
CREATE TABLE triage_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  experiment_id UUID NOT NULL REFERENCES triage_experiments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  arm TEXT NOT NULL CHECK (arm IN ('A', 'B', 'C')),
  is_shadow BOOLEAN NOT NULL DEFAULT FALSE,
  -- Classification output
  urgency_score INTEGER,
  topic_cluster TEXT,
  ownership_signal TEXT,
  requires_response BOOLEAN,
  escalation_level TEXT,
  confidence NUMERIC(4, 3),
  -- Route metadata
  used_heuristic BOOLEAN NOT NULL DEFAULT FALSE,
  used_snippet_model BOOLEAN NOT NULL DEFAULT FALSE,
  used_full_model BOOLEAN NOT NULL DEFAULT FALSE,
  model_name TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  estimated_cost_usd NUMERIC(10, 6) DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  -- Debugging
  reason_codes TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE triage_results ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_triage_results_signal ON triage_results(signal_id);
CREATE INDEX idx_triage_results_experiment ON triage_results(experiment_id, arm, is_shadow);
CREATE INDEX idx_triage_results_user ON triage_results(user_id, created_at DESC);
CREATE INDEX idx_triage_results_comparison ON triage_results(experiment_id, signal_id, arm);

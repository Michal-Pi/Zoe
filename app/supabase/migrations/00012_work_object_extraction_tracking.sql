-- Track extraction attempts on work objects to prevent infinite retry loops.
-- The scoring engine retries work objects that have no activities, but without
-- a cap this causes unbounded Sonnet calls every 3 minutes.

ALTER TABLE work_objects
ADD COLUMN IF NOT EXISTS extraction_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE work_objects
ADD COLUMN IF NOT EXISTS extraction_failed_at TIMESTAMPTZ;

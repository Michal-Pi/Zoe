ALTER TABLE work_objects
ADD COLUMN IF NOT EXISTS source_key TEXT;

CREATE INDEX IF NOT EXISTS idx_work_objects_user_source_key
  ON work_objects(user_id, source_key)
  WHERE source_key IS NOT NULL;

ALTER TABLE activities
ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

CREATE INDEX IF NOT EXISTS idx_activities_user_dedupe_key
  ON activities(user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

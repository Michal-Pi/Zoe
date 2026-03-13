CREATE UNIQUE INDEX IF NOT EXISTS uniq_activities_user_thread_dedupe_active
  ON activities(user_id, dedupe_key)
  WHERE dedupe_key LIKE 'thread:%'
    AND status IN ('pending', 'in_progress', 'snoozed');

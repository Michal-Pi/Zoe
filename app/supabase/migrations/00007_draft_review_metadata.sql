ALTER TABLE draft_replies
ADD COLUMN IF NOT EXISTS review_metadata JSONB DEFAULT '{}'::jsonb;

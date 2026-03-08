-- Add theme preference to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'system'
  CHECK (theme IN ('light', 'dark', 'system'));

-- Add admin role to profiles for system administration access.

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Grant admin to the project owner
UPDATE profiles SET is_admin = TRUE WHERE email = 'michal.pilawski@gmail.com';

-- Also set is_admin on future signups via the trigger (default false is fine,
-- but ensure the handle_new_user trigger doesn't overwrite it).

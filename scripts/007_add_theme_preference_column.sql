-- Add theme_preference column to users table
-- This allows users to store their theme preference in the database
-- for syncing across devices

ALTER TABLE public.video_users
ADD COLUMN IF NOT EXISTS theme_preference TEXT DEFAULT 'default';

-- Add a comment to explain the column
COMMENT ON COLUMN public.video_users.theme_preference IS 'User theme preference (e.g., default, christmas, dark, light). Stored in localStorage as fallback.';


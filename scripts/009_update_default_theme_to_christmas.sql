-- Update default theme preference to 'christmas' for new users
-- Existing users will keep their current preference

ALTER TABLE public.users
ALTER COLUMN theme_preference SET DEFAULT 'christmas';

-- Update the comment to reflect the new default
COMMENT ON COLUMN public.users.theme_preference IS 'User theme preference (e.g., christmas, default, dark, light). Default is christmas. Stored in localStorage as fallback.';


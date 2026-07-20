-- Migration 010: Add video_processed_webhook_events table for webhook idempotency (D-01)
-- and add credit_cost column to video_history for refund amounts (D-02/D-03)
--
-- NOTE: the user_id FK below points at public.users, which belongs to a different
-- project sharing this Supabase instance, not this app's public.video_users. See
-- 013_fix_processed_webhook_events_user_fk.sql for the correction.

-- Add credit_cost to video_history so refund handler knows exact amount (D-03)
ALTER TABLE public.video_history
  ADD COLUMN IF NOT EXISTS credit_cost integer;

-- Idempotency audit table for all webhook providers (D-01)
-- UNIQUE(provider, event_id, event_type) prevents double-processing of any webhook event
CREATE TABLE IF NOT EXISTS public.video_processed_webhook_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   text NOT NULL,
  event_id     text NOT NULL,
  provider     text NOT NULL,
  user_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  processed_at timestamp with time zone DEFAULT now(),
  created_at   timestamp with time zone DEFAULT now(),
  UNIQUE (provider, event_id, event_type)
);

-- RLS: service role bypasses; no user-facing access needed for this audit table
ALTER TABLE public.video_processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- Migration 011: Atomic credit deduction RPC + credit refund RPC (D-02, D-03)

-- RPC 1: deduct_credits_and_create_video
-- Atomically validates balance, deducts credits, and inserts a video_history row.
-- If any step fails, the entire transaction rolls back (no partial state).
-- SECURITY DEFINER runs as function owner (bypasses RLS for internal writes).
-- Callers must be authenticated (authenticated role has EXECUTE grant below).
CREATE OR REPLACE FUNCTION public.deduct_credits_and_create_video(
  p_user_id     uuid,
  p_credit_cost integer,
  p_prompt      text,
  p_duration    integer,
  p_model       text,
  p_image_url   text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_credits integer;
  v_video_entry     json;
BEGIN
  -- Lock user row to prevent concurrent deductions (SELECT FOR UPDATE serializes)
  SELECT credits INTO v_current_credits
  FROM public.video_users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_credits IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF v_current_credits < p_credit_cost THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  -- Atomic credit deduction
  UPDATE public.video_users
  SET credits = credits - p_credit_cost
  WHERE id = p_user_id;

  -- Atomic video_history creation (credit_cost stored for refund path)
  INSERT INTO public.video_history (user_id, prompt, image_url, duration, model, status, credit_cost)
  VALUES (p_user_id, p_prompt, p_image_url, p_duration, p_model, 'processing', p_credit_cost)
  RETURNING to_json(video_history.*) INTO v_video_entry;

  RETURN v_video_entry;
END;
$$;

-- Grant EXECUTE to authenticated users so the generate route (user-session client) can call it
GRANT EXECUTE ON FUNCTION public.deduct_credits_and_create_video(uuid, integer, text, integer, text, text)
  TO authenticated;

-- RPC 2: refund_video_credits
-- Safely increments user credits using SQL arithmetic (not an absolute set).
-- Using credits + N prevents snapshot-overwrite race condition (RESEARCH.md anti-pattern).
-- Called by the Kling webhook handler on task_status = "failed".
-- SECURITY DEFINER so service role client does not need direct users table access.
CREATE OR REPLACE FUNCTION public.refund_video_credits(
  p_user_id uuid,
  p_amount  integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.video_users
  SET credits = credits + p_amount
  WHERE id = p_user_id;
END;
$$;

-- Grant EXECUTE to service_role (webhook handlers use service role client)
GRANT EXECUTE ON FUNCTION public.refund_video_credits(uuid, integer)
  TO service_role;

-- Add job_id column to video_history table for async video generation tracking
alter table public.video_history 
add column if not exists job_id text;

-- Add index on job_id for faster lookups
create index if not exists idx_video_history_job_id 
on public.video_history(job_id);

-- Add comment
comment on column public.video_history.job_id is 'OpenAI job ID for async video generation tracking';


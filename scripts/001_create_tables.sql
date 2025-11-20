  -- Create users table with credits system
  create table if not exists public.users (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    credits integer not null default 10,
    created_at timestamp with time zone default now()
  );

  -- Enable RLS on users table
  alter table public.users enable row level security;

  -- RLS policies for users table
  create policy "users_select_own"
    on public.users for select
    using (auth.uid() = id);

  create policy "users_insert_own"
    on public.users for insert
    with check (auth.uid() = id);

  create policy "users_update_own"
    on public.users for update
    using (auth.uid() = id);

  -- Create video_history table
  create table if not exists public.video_history (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    prompt text not null,
    image_url text,
    video_url text,
    duration integer not null,
    model text not null,
    status text not null default 'processing',
    created_at timestamp with time zone default now()
  );

  -- Enable RLS on video_history table
  alter table public.video_history enable row level security;

  -- RLS policies for video_history table
  create policy "video_history_select_own"
    on public.video_history for select
    using (auth.uid() = user_id);

  create policy "video_history_insert_own"
    on public.video_history for insert
    with check (auth.uid() = user_id);

  create policy "video_history_update_own"
    on public.video_history for update
    using (auth.uid() = user_id);

  create policy "video_history_delete_own"
    on public.video_history for delete
    using (auth.uid() = user_id);

  -- Create transactions table
  create table if not exists public.transactions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    amount integer not null,
    credits_purchased integer not null,
    stripe_session_id text,
    status text not null default 'completed',
    created_at timestamp with time zone default now()
  );

  -- Enable RLS on transactions table
  alter table public.transactions enable row level security;

  -- RLS policies for transactions table
  create policy "transactions_select_own"
    on public.transactions for select
    using (auth.uid() = user_id);

  create policy "transactions_insert_own"
    on public.transactions for insert
    with check (auth.uid() = user_id);

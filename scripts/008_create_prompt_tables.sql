-- Create prompt_settings table for storing default prefix prompts
-- This allows adjusting the prefix prompt on the fly without code changes
create table if not exists public.prompt_settings (
  id uuid primary key default gen_random_uuid(),
  prefix_prompt text not null,
  is_active boolean not null default true,
  description text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS on prompt_settings table
alter table public.prompt_settings enable row level security;

-- RLS policies for prompt_settings table
-- Only authenticated users can read active settings
create policy "prompt_settings_select_active"
  on public.prompt_settings for select
  using (auth.role() = 'authenticated' and is_active = true);

-- Note: For insert/update operations, you'll need to use the Supabase dashboard
-- or create a service role function. For now, we'll allow authenticated users
-- to read, but restrict writes. You can manage prompts via SQL directly or
-- create an admin API endpoint with service role key.

-- Create predefined_prompts table for storing generic prompts users can pick from
create table if not exists public.predefined_prompts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  prompt text not null,
  category text,
  description text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS on predefined_prompts table
alter table public.predefined_prompts enable row level security;

-- RLS policies for predefined_prompts table
-- All authenticated users can read active prompts
create policy "predefined_prompts_select_active"
  on public.predefined_prompts for select
  using (auth.role() = 'authenticated' and is_active = true);

-- Note: For insert/update operations, you'll need to use the Supabase dashboard
-- or create a service role function. For now, we'll allow authenticated users
-- to read, but restrict writes. You can manage prompts via SQL directly or
-- create an admin API endpoint with service role key.

-- Create index for faster lookups
create index if not exists idx_prompt_settings_active on public.prompt_settings(is_active) where is_active = true;
create index if not exists idx_predefined_prompts_active on public.predefined_prompts(is_active, display_order) where is_active = true;

-- Insert default prefix prompt (you can update this later via admin)
insert into public.prompt_settings (prefix_prompt, is_active, description)
values (
  'Create a high-quality, cinematic video with smooth motion, professional lighting, and excellent composition. The video should be visually stunning and engaging.',
  true,
  'Default prefix prompt for all video generations'
)
on conflict do nothing;

-- Insert some example predefined prompts (you can add more via admin)
insert into public.predefined_prompts (title, prompt, category, description, is_active, display_order)
values
  (
    'Nature Scene',
    'A serene landscape with mountains in the background, a calm lake in the foreground, gentle breeze moving through trees, golden hour lighting',
    'nature',
    'Peaceful outdoor scene with natural elements',
    true,
    1
  ),
  (
    'City Life',
    'Busy city street with people walking, cars passing by, modern architecture, vibrant urban atmosphere, daytime',
    'urban',
    'Dynamic city scene with movement and energy',
    true,
    2
  ),
  (
    'Abstract Art',
    'Colorful abstract patterns flowing and morphing, smooth transitions between shapes, vibrant colors, artistic composition',
    'abstract',
    'Creative abstract visual experience',
    true,
    3
  ),
  (
    'Product Showcase',
    'Professional product presentation with smooth camera movement, studio lighting, clean background, highlighting product details',
    'commercial',
    'Professional product demonstration',
    true,
    4
  ),
  (
    'Food Preparation',
    'Close-up of hands preparing fresh ingredients, cooking process, appetizing presentation, warm lighting, kitchen setting',
    'food',
    'Appetizing cooking and food scene',
    true,
    5
  ),
  (
    'Technology',
    'Modern tech workspace with screens, devices, and digital interfaces, clean and organized, professional lighting',
    'technology',
    'Contemporary technology environment',
    true,
    6
  ),
  (
    'Travel',
    'Beautiful travel destination with scenic views, cultural elements, exploration vibe, cinematic composition',
    'travel',
    'Inspiring travel and adventure scene',
    true,
    7
  ),
  (
    'Fitness',
    'Active fitness scene with movement, energy, motivation, modern gym or outdoor setting, dynamic action',
    'lifestyle',
    'Energetic fitness and wellness scene',
    true,
    8
  )
on conflict do nothing;


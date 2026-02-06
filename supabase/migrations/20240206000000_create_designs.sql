-- Designs table
create table designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'Untitled',
  document jsonb not null,
  thumbnail text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table designs enable row level security;

-- Users can only see their own designs
create policy "Users can view own designs"
  on designs for select
  using (auth.uid() = user_id);

create policy "Users can insert own designs"
  on designs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own designs"
  on designs for update
  using (auth.uid() = user_id);

create policy "Users can delete own designs"
  on designs for delete
  using (auth.uid() = user_id);

-- Index for faster queries
create index designs_user_id_idx on designs(user_id);
create index designs_updated_at_idx on designs(updated_at desc);

-- Usage tracking table
create table usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null default current_date,
  prompt_count integer not null default 0,
  created_at timestamp with time zone default now(),
  unique(user_id, date)
);

-- Enable RLS
alter table usage enable row level security;

-- Users can only see their own usage
create policy "Users can view own usage"
  on usage for select
  using (auth.uid() = user_id);

create policy "Users can insert own usage"
  on usage for insert
  with check (auth.uid() = user_id);

create policy "Users can update own usage"
  on usage for update
  using (auth.uid() = user_id);

-- Index for fast lookups
create index usage_user_date_idx on usage(user_id, date);

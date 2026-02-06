-- Design versions table for version history
create table design_versions (
  id uuid primary key default gen_random_uuid(),
  design_id uuid references designs(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  document jsonb not null,
  thumbnail text,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table design_versions enable row level security;

-- Users can only see their own versions
create policy "Users can view own versions"
  on design_versions for select
  using (auth.uid() = user_id);

create policy "Users can insert own versions"
  on design_versions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own versions"
  on design_versions for delete
  using (auth.uid() = user_id);

-- Index for fast lookups
create index design_versions_design_id_idx on design_versions(design_id);
create index design_versions_created_at_idx on design_versions(design_id, created_at desc);

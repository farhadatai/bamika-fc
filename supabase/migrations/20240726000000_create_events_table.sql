-- Create events table
create table public.events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  date date not null,
  time time not null,
  location text not null,
  description text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.events enable row level security;

-- Policies
create policy "Public can view events" on public.events
  for select using (true);

create policy "Admins can insert events" on public.events
  for insert with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can update events" on public.events
  for update using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can delete events" on public.events
  for delete using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Ensure public schedule tables exist and can be shown without login.
create table if not exists public.games (
  id uuid default gen_random_uuid() primary key,
  opponent text not null,
  date date not null,
  time time,
  location text not null default 'Home',
  created_at timestamptz default now()
);

create table if not exists public.events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  date date not null,
  time time not null,
  location text not null,
  description text,
  created_at timestamptz default now()
);

alter table public.games enable row level security;
alter table public.events enable row level security;

drop policy if exists "Public can view games" on public.games;
drop policy if exists "Admins can insert games" on public.games;
drop policy if exists "Admins can update games" on public.games;
drop policy if exists "Admins can delete games" on public.games;

create policy "Public can view games" on public.games
  for select using (true);

create policy "Admins can insert games" on public.games
  for insert with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can update games" on public.games
  for update using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can delete games" on public.games
  for delete using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists "Public can view events" on public.events;
drop policy if exists "Admins can insert events" on public.events;
drop policy if exists "Admins can update events" on public.events;
drop policy if exists "Admins can delete events" on public.events;

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

grant select on public.games to anon, authenticated;
grant insert, update, delete on public.games to authenticated;
grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;

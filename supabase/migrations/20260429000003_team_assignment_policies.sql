-- Team assignment support for admin and coach dashboards.
-- Team names are stored as text so the club can split large groups into A/B/C teams,
-- for example U8 A, U8 B, U8 C, U10 A, U10 B, U10 C, etc.
alter table public.coaches add column if not exists team_id text;
alter table public.players add column if not exists team_assigned text default 'Unassigned';

alter table public.coaches enable row level security;
alter table public.players enable row level security;

drop policy if exists "Admins can assign coach teams" on public.coaches;
drop policy if exists "Coaches can view own coach row" on public.coaches;
drop policy if exists "Admins can assign player teams" on public.players;
drop policy if exists "Coaches can view team players" on public.players;
drop policy if exists "Parents can view own players" on public.players;

create policy "Admins can assign coach teams" on public.coaches
  for update using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Coaches can view own coach row" on public.coaches
  for select using (
    id = auth.uid()
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can assign player teams" on public.players
  for update using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Coaches can view team players" on public.players
  for select using (
    exists (
      select 1 from public.coaches
      where coaches.id = auth.uid()
      and coaches.team_id = players.team_assigned
    )
  );

create policy "Parents can view own players" on public.players
  for select using (parent_id = auth.uid());

grant select, update on public.coaches to authenticated;
grant select, update on public.players to authenticated;

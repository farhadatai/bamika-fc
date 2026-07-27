-- =============================================================================
-- Tournament teams + printable lineups.
--
-- Run this WHOLE file in: Supabase dashboard -> SQL Editor -> New query -> Run.
-- Safe to re-run (idempotent).
--
-- What it adds:
--   * tournament_teams        — an event roster: name, color, age group, game
--                               format (7v7/9v9/...), formation, assigned coach.
--   * tournament_team_players — which players are on that roster, which slot of
--                               the formation they occupy, and starter/sub.
--
-- Access rules:
--   * Admins: full control over every team.
--   * Coaches: can read all teams, and create/edit teams they own (assigned as
--     coach, or that they created).
--   * Parents/anonymous: no access.
-- =============================================================================

-- Helper (already present if the profiles security fix was applied; recreated
-- here so this file stands alone). SECURITY DEFINER avoids RLS recursion.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.is_coach()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('coach', 'admin')
  );
$$;

revoke all on function public.is_coach() from public;
grant execute on function public.is_coach() to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.tournament_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text default 'red',
  age_group text,
  event_name text,
  format text default '7v7',
  formation_id text,
  coach_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.tournament_team_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.tournament_teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  slot_id text,
  is_starter boolean default true,
  created_at timestamptz default now(),
  unique (team_id, player_id)
);

create index if not exists tournament_team_players_team_idx
  on public.tournament_team_players(team_id);
create index if not exists tournament_teams_coach_idx
  on public.tournament_teams(coach_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.tournament_teams enable row level security;
alter table public.tournament_team_players enable row level security;

drop policy if exists "Staff can read tournament teams"      on public.tournament_teams;
drop policy if exists "Staff can create tournament teams"    on public.tournament_teams;
drop policy if exists "Owners can update tournament teams"   on public.tournament_teams;
drop policy if exists "Owners can delete tournament teams"   on public.tournament_teams;

create policy "Staff can read tournament teams" on public.tournament_teams
  for select to authenticated
  using (public.is_coach());

create policy "Staff can create tournament teams" on public.tournament_teams
  for insert to authenticated
  with check (public.is_coach());

create policy "Owners can update tournament teams" on public.tournament_teams
  for update to authenticated
  using (public.is_admin() or coach_id = auth.uid() or created_by = auth.uid())
  with check (public.is_admin() or coach_id = auth.uid() or created_by = auth.uid());

create policy "Owners can delete tournament teams" on public.tournament_teams
  for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

drop policy if exists "Staff can read team players"   on public.tournament_team_players;
drop policy if exists "Owners can manage team players" on public.tournament_team_players;

create policy "Staff can read team players" on public.tournament_team_players
  for select to authenticated
  using (public.is_coach());

create policy "Owners can manage team players" on public.tournament_team_players
  for all to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.tournament_teams t
      where t.id = tournament_team_players.team_id
        and (t.coach_id = auth.uid() or t.created_by = auth.uid())
    )
  )
  with check (
    public.is_admin() or exists (
      select 1 from public.tournament_teams t
      where t.id = tournament_team_players.team_id
        and (t.coach_id = auth.uid() or t.created_by = auth.uid())
    )
  );

grant select, insert, update, delete on public.tournament_teams to authenticated;
grant select, insert, update, delete on public.tournament_team_players to authenticated;

-- Coaches need to see every player to build a tournament roster across teams.
-- Parents remain limited to their own children by the existing policy.
drop policy if exists "Coaches can view all players" on public.players;
create policy "Coaches can view all players" on public.players
  for select to authenticated
  using (public.is_coach());

notify pgrst, 'reload schema';

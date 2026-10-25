-- Bamika FC tournament hosting: public club registration (no account needed),
-- admin approval, and per-team entries. Phase 1 = request + approve.
-- Note: `tournament_teams` already belongs to the internal Teams & Lineups
-- planner (APPLY_TOURNAMENT_TEAMS.sql), so visiting clubs' entries live in
-- `tournament_club_teams`.
-- Payments, rosters, schedule and live scores build on these same tables.

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  venue_name text,
  venue_address text,
  team_fee_cents integer not null default 25000,
  divisions text[] not null default array['U8','U10','U12','U14','U16'],
  roster_min integer not null default 9,
  roster_max integer not null default 18,
  registration_open boolean not null default true,
  roster_deadline date,
  created_at timestamptz not null default now()
);

create table if not exists public.tournament_clubs (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  reference_code text not null unique,
  club_name text not null,
  contact_name text not null,
  email text not null,
  phone text not null,
  city text,
  notes text,
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  -- Secret link token: the club's "key card" for payments + rosters (no account).
  access_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.tournament_club_teams (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.tournament_clubs(id) on delete cascade,
  division text not null,
  team_name text not null,
  group_label text,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','refunded')),
  stripe_checkout_session_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists tournament_clubs_tournament_idx on public.tournament_clubs(tournament_id, status);
create index if not exists tournament_club_teams_club_idx on public.tournament_club_teams(club_id);

alter table public.tournaments enable row level security;
alter table public.tournament_clubs enable row level security;
alter table public.tournament_club_teams enable row level security;

-- Public (even logged-out) visitors may read tournament info for the /tournament page.
grant select on public.tournaments to anon, authenticated;
drop policy if exists "tournaments_public_read" on public.tournaments;
create policy "tournaments_public_read" on public.tournaments
  for select to anon, authenticated using (true);

-- Club requests and teams: written only through the API (service role). Admins
-- manage them from the dashboard. Nobody else can read contact details.
grant select, update, delete on public.tournament_clubs to authenticated;
grant select, update, delete on public.tournament_club_teams to authenticated;

drop policy if exists "tournament_clubs_admin" on public.tournament_clubs;
create policy "tournament_clubs_admin" on public.tournament_clubs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "tournament_club_teams_admin" on public.tournament_club_teams;
create policy "tournament_club_teams_admin" on public.tournament_club_teams
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "tournaments_admin_write" on public.tournaments;
create policy "tournaments_admin_write" on public.tournaments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant insert, update on public.tournaments to authenticated;

-- The Nov 28-29 tournament. Venue is filled in later from the admin tab.
insert into public.tournaments (slug, name, starts_on, ends_on, team_fee_cents)
values ('bamika-cup-2026', 'Bamika FC Tournament Cup', '2026-11-28', '2026-11-29', 25000)
on conflict (slug) do update set name = excluded.name;

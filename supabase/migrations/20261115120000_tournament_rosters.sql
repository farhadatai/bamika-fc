-- Tournament rosters: players entered by visiting clubs for each PAID team,
-- with a birth certificate stored in a private bucket. Clubs add players
-- through the API using their private club link (no account), so the table
-- is written only by the service role; admins read it from the dashboard.

create table if not exists public.tournament_roster_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.tournament_club_teams(id) on delete cascade,
  club_id uuid not null references public.tournament_clubs(id) on delete cascade,
  full_name text not null,
  date_of_birth date not null,
  jersey_number text,
  birth_cert_path text,
  created_at timestamptz not null default now()
);

create index if not exists tournament_roster_players_team_idx on public.tournament_roster_players(team_id);

alter table public.tournament_roster_players enable row level security;

grant select, delete on public.tournament_roster_players to authenticated;

drop policy if exists "tournament_roster_players_admin" on public.tournament_roster_players;
create policy "tournament_roster_players_admin" on public.tournament_roster_players
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Private bucket for tournament birth certificates. Only the server (service
-- role) uploads and signs download links, so no storage policies are needed.
insert into storage.buckets (id, name, public)
values ('tournament-docs', 'tournament-docs', false)
on conflict (id) do nothing;

-- Bamika FC's own teams in the tournament: coaches enter their team (no entry
-- fee) and pick players straight from the club roster. One "home" club row
-- (is_home) is created by the API the first time a coach enters a team.

alter table public.tournament_clubs
  add column if not exists is_home boolean not null default false;

alter table public.tournament_club_teams
  drop constraint if exists tournament_club_teams_payment_status_check;
alter table public.tournament_club_teams
  add constraint tournament_club_teams_payment_status_check
  check (payment_status in ('unpaid','paid','refunded','waived'));

-- Which Bamika team (e.g. "U14 A") owns this entry, and which coach created it.
alter table public.tournament_club_teams
  add column if not exists coach_team text,
  add column if not exists created_by uuid;

-- Roster players copied from the club's own players table keep a link back so
-- the same child cannot be entered twice on one team.
alter table public.tournament_roster_players
  add column if not exists source_player_id uuid references public.players(id) on delete set null;

create unique index if not exists tournament_roster_players_source_unique
  on public.tournament_roster_players(team_id, source_player_id)
  where source_player_id is not null;

create unique index if not exists tournament_clubs_home_unique
  on public.tournament_clubs(tournament_id)
  where is_home;

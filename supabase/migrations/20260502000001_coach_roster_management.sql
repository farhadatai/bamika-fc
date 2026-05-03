-- Let assigned coaches manage roster details for players on their own team.
-- Safe to run more than once in Supabase SQL Editor.

alter table public.players add column if not exists position text default 'TBD';
alter table public.players add column if not exists jersey_number text default '-';
alter table public.players add column if not exists jersey_size text;
alter table public.players add column if not exists team_assigned text default 'Unassigned';

alter table public.players enable row level security;

drop policy if exists "Coaches can update own team roster details" on public.players;

create policy "Coaches can update own team roster details" on public.players
  for update using (
    exists (
      select 1 from public.coaches
      where coaches.id = auth.uid()
      and coaches.team_id = players.team_assigned
    )
  )
  with check (
    exists (
      select 1 from public.coaches
      where coaches.id = auth.uid()
      and coaches.team_id = players.team_assigned
    )
  );

grant select, update on public.players to authenticated;

-- Allow coaches to send a message to one player/family or the whole team.
-- Safe to run more than once.

alter table public.announcements
  add column if not exists player_id uuid references public.players(id) on delete set null;

create index if not exists announcements_player_id_idx
  on public.announcements(player_id);

alter table public.announcements enable row level security;

drop policy if exists "Anyone can view active announcements" on public.announcements;

create policy "Anyone can view active announcements" on public.announcements
  for select using (
    audience in ('public', 'everyone')
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and (
        profiles.role = 'admin'
        or (profiles.role = 'coach' and audience in ('coaches', 'everyone'))
        or (profiles.role = 'user' and audience in ('parents', 'everyone'))
      )
    )
    or (
      audience = 'team'
      and (
        exists (
          select 1 from public.coaches
          where coaches.id = auth.uid()
          and coaches.team_id = announcements.team_id
        )
        or exists (
          select 1 from public.players
          where players.parent_id = auth.uid()
          and players.team_assigned = announcements.team_id
        )
      )
    )
    or (
      audience = 'player'
      and (
        exists (
          select 1 from public.coaches
          join public.players on players.id = announcements.player_id
          where coaches.id = auth.uid()
          and coaches.team_id = players.team_assigned
        )
        or exists (
          select 1 from public.players
          where players.id = announcements.player_id
          and players.parent_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "Coaches can insert team announcements" on public.announcements;

create policy "Coaches can insert team announcements" on public.announcements
  for insert to authenticated
  with check (
    audience in ('team', 'player')
    and exists (
      select 1 from public.coaches
      where coaches.id = auth.uid()
      and coaches.team_id = announcements.team_id
    )
    and (
      audience = 'team'
      or exists (
        select 1 from public.players
        where players.id = announcements.player_id
        and players.team_assigned = announcements.team_id
      )
    )
  );

drop policy if exists "Coaches can delete own team announcements" on public.announcements;

create policy "Coaches can delete own team announcements" on public.announcements
  for delete to authenticated
  using (
    audience in ('team', 'player')
    and exists (
      select 1 from public.coaches
      where coaches.id = auth.uid()
      and coaches.team_id = announcements.team_id
    )
  );

grant select on public.announcements to anon, authenticated;
grant insert, update, delete on public.announcements to authenticated;

notify pgrst, 'reload schema';

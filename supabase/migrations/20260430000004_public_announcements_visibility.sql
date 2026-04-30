-- Keep public homepage announcements visible until an admin deletes them.
-- Safe to run more than once in Supabase SQL Editor.

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
  );

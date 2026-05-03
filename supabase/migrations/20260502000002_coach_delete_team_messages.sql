-- Let assigned coaches delete team messages they posted for their assigned team.
-- Safe to run more than once in Supabase SQL Editor.

alter table public.announcements enable row level security;

drop policy if exists "Coaches can delete own team announcements" on public.announcements;

create policy "Coaches can delete own team announcements" on public.announcements
  for delete to authenticated
  using (
    audience = 'team'
    and exists (
      select 1 from public.coaches
      where coaches.id = auth.uid()
      and coaches.team_id = announcements.team_id
    )
  );

grant delete on public.announcements to authenticated;

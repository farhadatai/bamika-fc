-- Required schema for the Bamika FC admin dashboard.
-- Safe to run more than once in Supabase SQL Editor.

alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists photo_url text;

create table if not exists public.announcements (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  body text not null,
  audience text not null default 'public',
  team_id text,
  priority text not null default 'normal',
  is_pinned boolean not null default false,
  expires_at date,
  created_at timestamptz default now()
);

alter table public.announcements add column if not exists team_id text;
alter table public.announcements add column if not exists priority text not null default 'normal';
alter table public.announcements add column if not exists is_pinned boolean not null default false;
alter table public.announcements add column if not exists expires_at date;
alter table public.announcements add column if not exists created_at timestamptz default now();

alter table public.coaches add column if not exists team_id text;
alter table public.coaches add column if not exists bio text;
alter table public.coaches add column if not exists is_published boolean default true;

alter table public.players add column if not exists parent_id uuid references public.profiles(id) on delete cascade;
alter table public.players add column if not exists first_name text;
alter table public.players add column if not exists last_name text;
alter table public.players add column if not exists date_of_birth date;
alter table public.players add column if not exists gender text;
alter table public.players add column if not exists medical_conditions text;
alter table public.players add column if not exists photo_url text;
alter table public.players add column if not exists team_assigned text default 'Unassigned';
alter table public.players add column if not exists position text default 'TBD';
alter table public.players add column if not exists jersey_number text;
alter table public.players add column if not exists jersey_size text;
alter table public.players add column if not exists payment_status text default 'pending';
alter table public.players add column if not exists status text default 'pending';

alter table public.announcements enable row level security;

drop policy if exists "Anyone can view active announcements" on public.announcements;
drop policy if exists "Admins can insert announcements" on public.announcements;
drop policy if exists "Coaches can insert team announcements" on public.announcements;
drop policy if exists "Admins can update announcements" on public.announcements;
drop policy if exists "Admins can delete announcements" on public.announcements;
drop policy if exists "Coaches can update own team roster details" on public.players;

create policy "Anyone can view active announcements" on public.announcements
  for select using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
    or (
      (expires_at is null or expires_at >= current_date)
      and (
        audience in ('public', 'everyone')
        or exists (
          select 1 from public.profiles
          where profiles.id = auth.uid()
          and (
            (profiles.role = 'coach' and audience = 'coaches')
            or (profiles.role = 'user' and audience = 'parents')
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
      )
    )
  );

create policy "Admins can insert announcements" on public.announcements
  for insert with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Coaches can insert team announcements" on public.announcements
  for insert with check (
    audience = 'team'
    and exists (
      select 1 from public.coaches
      where coaches.id = auth.uid()
      and coaches.team_id = announcements.team_id
    )
  );

create policy "Admins can update announcements" on public.announcements
  for update using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can delete announcements" on public.announcements
  for delete using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

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

grant select on public.announcements to anon, authenticated;
grant insert, update, delete on public.announcements to authenticated;
grant select, update on public.coaches to authenticated;
grant select, insert, update on public.players to authenticated;

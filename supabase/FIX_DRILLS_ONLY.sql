-- Bamika FC drills table repair
-- Run this in Supabase Dashboard > SQL Editor, then click Run.

create table if not exists public.drills (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  video_url text,
  youtube_url text,
  thumbnail_url text,
  duration integer not null default 15,
  difficulty text not null default 'Beginner',
  category text not null default 'Dribbling',
  description text,
  created_at timestamptz default now()
);

alter table public.drills add column if not exists youtube_url text;
alter table public.drills add column if not exists video_url text;
update public.drills
set video_url = coalesce(video_url, youtube_url),
    youtube_url = coalesce(youtube_url, video_url)
where video_url is null
   or youtube_url is null;
alter table public.drills add column if not exists thumbnail_url text;
alter table public.drills add column if not exists duration integer not null default 15;
alter table public.drills add column if not exists difficulty text not null default 'Beginner';
alter table public.drills add column if not exists category text not null default 'Dribbling';
alter table public.drills add column if not exists description text;
alter table public.drills add column if not exists created_at timestamptz default now();

alter table public.drills enable row level security;

drop policy if exists "Public can view drills" on public.drills;
drop policy if exists "Admins can insert drills" on public.drills;
drop policy if exists "Admins can update drills" on public.drills;
drop policy if exists "Admins can delete drills" on public.drills;

create policy "Public can view drills" on public.drills
  for select using (true);

create policy "Admins can insert drills" on public.drills
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can update drills" on public.drills
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can delete drills" on public.drills
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

grant select on public.drills to anon, authenticated;
grant insert, update, delete on public.drills to authenticated;

-- Force Supabase/PostgREST to refresh the schema cache immediately.
notify pgrst, 'reload schema';

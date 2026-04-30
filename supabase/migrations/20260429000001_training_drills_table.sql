-- Training videos shown on the public Training Lab and managed from admin.
create table if not exists public.drills (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  video_url text not null,
  thumbnail_url text,
  duration integer not null default 15,
  difficulty text not null default 'Beginner',
  category text not null default 'Dribbling',
  description text,
  created_at timestamptz default now()
);

alter table public.drills enable row level security;

drop policy if exists "Public can view drills" on public.drills;
drop policy if exists "Admins can insert drills" on public.drills;
drop policy if exists "Admins can update drills" on public.drills;
drop policy if exists "Admins can delete drills" on public.drills;

create policy "Public can view drills" on public.drills
  for select using (true);

create policy "Admins can insert drills" on public.drills
  for insert with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can update drills" on public.drills
  for update using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can delete drills" on public.drills
  for delete using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

grant select on public.drills to anon, authenticated;
grant insert, update, delete on public.drills to authenticated;

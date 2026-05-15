-- Bamika FC live database repair script
-- Run this in Supabase Dashboard > SQL Editor, then click Run.

alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists photo_url text;

alter table public.players add column if not exists parent_id uuid references public.profiles(id) on delete cascade;
alter table public.players add column if not exists full_name text;
alter table public.players add column if not exists first_name text;
alter table public.players add column if not exists last_name text;
alter table public.players add column if not exists date_of_birth date;
alter table public.players add column if not exists gender text;
alter table public.players add column if not exists position text default 'TBD';
alter table public.players add column if not exists jersey_number text default '-';
alter table public.players add column if not exists jersey_size text;
alter table public.players add column if not exists medical_conditions text;
alter table public.players add column if not exists photo_url text;
alter table public.players add column if not exists team_assigned text default 'Unassigned';
alter table public.players add column if not exists status text default 'pending_payment';
alter table public.players add column if not exists payment_status text default 'pending';
alter table public.players add column if not exists waiver_signed boolean default false;
alter table public.players add column if not exists stripe_subscription_id text;
alter table public.players add column if not exists stripe_customer_id text;
alter table public.players add column if not exists uniform_purchased boolean default false;
alter table public.players add column if not exists uniform_confirmation_code text;
alter table public.players add column if not exists created_at timestamptz default now();

alter table public.registrations add column if not exists stripe_customer_id text;
alter table public.registrations add column if not exists uniform_purchased boolean default false;
alter table public.registrations add column if not exists uniform_confirmation_code text;
alter table public.registrations add column if not exists player_id uuid;
alter table public.registrations add column if not exists parent_id uuid;
alter table public.registrations add column if not exists payment_status text default 'pending';
alter table public.registrations add column if not exists status text default 'pending';
alter table public.registrations add column if not exists stripe_subscription_id text;

alter table public.coaches add column if not exists team_id text;
alter table public.coaches add column if not exists bio text;
alter table public.coaches add column if not exists is_published boolean default true;

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

create table if not exists public.recognition_items (
  id uuid default gen_random_uuid() primary key,
  type text not null default 'player',
  title text not null,
  subtitle text,
  body text not null,
  image_url text,
  link_url text,
  is_published boolean not null default true,
  created_at timestamptz default now()
);

alter table public.drills add column if not exists youtube_url text;
alter table public.drills add column if not exists video_url text;
update public.drills
set video_url = coalesce(video_url, youtube_url),
    youtube_url = coalesce(youtube_url, video_url)
where video_url is null
   or youtube_url is null;
alter table public.announcements add column if not exists team_id text;
alter table public.announcements add column if not exists priority text not null default 'normal';
alter table public.announcements add column if not exists is_pinned boolean not null default false;
alter table public.announcements add column if not exists expires_at date;
alter table public.announcements add column if not exists created_at timestamptz default now();

alter table public.drills add column if not exists thumbnail_url text;
alter table public.drills add column if not exists duration integer not null default 15;
alter table public.drills add column if not exists difficulty text not null default 'Beginner';
alter table public.drills add column if not exists category text not null default 'Dribbling';
alter table public.drills add column if not exists description text;
alter table public.drills add column if not exists created_at timestamptz default now();

do $$
declare
  constraint_name text;
begin
  select tc.constraint_name
  into constraint_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'registrations'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'player_id'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.registrations drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.registrations
  add constraint registrations_player_id_fkey
  foreign key (player_id)
  references public.players(id)
  on delete cascade
  not valid;

do $$
declare
  constraint_name text;
begin
  select tc.constraint_name
  into constraint_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'registrations'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'parent_id'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.registrations drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.registrations
  add constraint registrations_parent_id_fkey
  foreign key (parent_id)
  references public.profiles(id)
  on delete cascade
  not valid;

create index if not exists idx_players_parent_full_name_status
  on public.players(parent_id, full_name, status);

create index if not exists idx_registrations_parent_player
  on public.registrations(parent_id, player_id);

create index if not exists idx_registrations_payment_status
  on public.registrations(payment_status, status);

alter table public.recognition_items add column if not exists type text not null default 'player';
alter table public.recognition_items add column if not exists title text;
alter table public.recognition_items add column if not exists subtitle text;
alter table public.recognition_items add column if not exists body text;
alter table public.recognition_items add column if not exists image_url text;
alter table public.recognition_items add column if not exists link_url text;
alter table public.recognition_items add column if not exists is_published boolean not null default true;
alter table public.recognition_items add column if not exists created_at timestamptz default now();

update public.profiles
set
  first_name = coalesce(
    nullif(first_name, ''),
    nullif(split_part(coalesce(full_name, ''), ' ', 1), '')
  ),
  last_name = coalesce(
    nullif(last_name, ''),
    nullif(trim(regexp_replace(coalesce(full_name, ''), '^\S+\s*', '')), '')
  ),
  role = coalesce(role, 'user')
where first_name is null
  or last_name is null
  or role is null;

update public.players
set
  full_name = coalesce(full_name, trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))),
  position = coalesce(position, 'TBD'),
  jersey_number = coalesce(jersey_number, '-'),
  team_assigned = coalesce(team_assigned, 'Unassigned'),
  status = coalesce(status, 'pending_payment'),
  payment_status = coalesce(payment_status, 'pending')
where position is null
  or full_name is null
  or jersey_number is null
  or team_assigned is null
  or status is null
  or payment_status is null;

alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.coaches enable row level security;
alter table public.announcements enable row level security;
alter table public.drills enable row level security;
alter table public.recognition_items enable row level security;

drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Enable all access for authenticated users" on public.profiles;

create policy "Enable all access for authenticated users" on public.profiles
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists "Parents can insert own players" on public.players;
drop policy if exists "Parents can update own pending players" on public.players;
drop policy if exists "Parents can view own players" on public.players;
drop policy if exists "Admins can assign player teams" on public.players;
drop policy if exists "Admins can delete players" on public.players;
drop policy if exists "Coaches can view team players" on public.players;
drop policy if exists "Coaches can update own team roster details" on public.players;

create policy "Parents can insert own players" on public.players
  for insert to authenticated
  with check (parent_id = auth.uid());

create policy "Parents can update own pending players" on public.players
  for update to authenticated
  using (parent_id = auth.uid())
  with check (parent_id = auth.uid());

create policy "Parents can view own players" on public.players
  for select to authenticated
  using (parent_id = auth.uid());

create policy "Admins can assign player teams" on public.players
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can delete players" on public.players
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Coaches can view team players" on public.players
  for select to authenticated
  using (
    exists (
      select 1 from public.coaches
      where coaches.id = auth.uid()
      and coaches.team_id = players.team_assigned
    )
  );

create policy "Coaches can update own team roster details" on public.players
  for update to authenticated
  using (
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

drop policy if exists "Anyone can view active announcements" on public.announcements;
drop policy if exists "Admins can insert announcements" on public.announcements;
drop policy if exists "Coaches can insert team announcements" on public.announcements;
drop policy if exists "Admins can update announcements" on public.announcements;
drop policy if exists "Admins can delete announcements" on public.announcements;
drop policy if exists "Coaches can delete own team announcements" on public.announcements;

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

create policy "Admins can insert announcements" on public.announcements
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Coaches can insert team announcements" on public.announcements
  for insert to authenticated
  with check (
    audience = 'team'
    and exists (
      select 1 from public.coaches
      where coaches.id = auth.uid()
      and coaches.team_id = announcements.team_id
    )
  );

create policy "Admins can update announcements" on public.announcements
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can delete announcements" on public.announcements
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

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

drop policy if exists "Public can view published recognition items" on public.recognition_items;
drop policy if exists "Admins can manage recognition items" on public.recognition_items;

create policy "Public can view published recognition items" on public.recognition_items
  for select
  using (
    is_published = true
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can manage recognition items" on public.recognition_items
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.players to authenticated;
grant select, update on public.coaches to authenticated;
grant select on public.announcements to anon, authenticated;
grant insert, update, delete on public.announcements to authenticated;
grant select on public.drills to anon, authenticated;
grant insert, update, delete on public.drills to authenticated;
grant select on public.recognition_items to anon, authenticated;
grant insert, update, delete on public.recognition_items to authenticated;

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can view spotlight photos" on storage.objects;
drop policy if exists "Authenticated users can upload spotlight photos" on storage.objects;

create policy "Public can view spotlight photos" on storage.objects
  for select
  using (bucket_id = 'photos');

create policy "Authenticated users can upload spotlight photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos');

-- Force Supabase/PostgREST to refresh the schema cache immediately.
notify pgrst, 'reload schema';

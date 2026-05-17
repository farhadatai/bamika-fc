-- Bamika FC coach onboarding repair.
-- Safe to run more than once in Supabase SQL Editor.
-- Keeps the existing coaches table, but supports both old and current app column names.

alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists photo_url text;

alter table public.coaches add column if not exists name text;
alter table public.coaches add column if not exists role text;
alter table public.coaches add column if not exists full_name text;
alter table public.coaches add column if not exists specialty text;
alter table public.coaches add column if not exists bio text;
alter table public.coaches add column if not exists photo_url text;
alter table public.coaches add column if not exists team_id text;
alter table public.coaches add column if not exists is_published boolean default true;

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

update public.coaches
set
  full_name = coalesce(nullif(full_name, ''), nullif(name, '')),
  name = coalesce(nullif(name, ''), nullif(full_name, '')),
  specialty = coalesce(nullif(specialty, ''), nullif(role, ''), 'Coach'),
  role = coalesce(nullif(role, ''), nullif(specialty, ''), 'Coach'),
  is_published = coalesce(is_published, true);

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.coaches to authenticated;

notify pgrst, 'reload schema';

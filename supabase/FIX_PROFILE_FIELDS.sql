-- Bamika FC profile fields repair.
-- Run this in Supabase SQL Editor if invites or registration say profiles.first_name is missing.

alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists photo_url text;

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

grant select, insert, update on public.profiles to authenticated;

notify pgrst, 'reload schema';

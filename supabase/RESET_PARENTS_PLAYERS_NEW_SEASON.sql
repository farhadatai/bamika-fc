-- Bamika FC new season reset.
-- WARNING: This permanently deletes parent/player registration data.
-- It preserves admin accounts, coach accounts, schema, dashboards, Stripe config, and Supabase config.
-- Run only after exporting/backing up anything you need.

begin;

create temporary table reset_parent_ids as
select id
from public.profiles
where coalesce(role, 'user') not in ('admin', 'coach');

create temporary table reset_player_ids as
select id
from public.players;

create temporary table reset_auth_user_ids as
select id
from auth.users
where id not in (
  select id
  from public.profiles
  where coalesce(role, 'user') in ('admin', 'coach')
);

-- Remove uploaded player files. This keeps coach/sponsor photos in the shared photos bucket.
delete from storage.objects
where bucket_id in ('player-photos', 'birth_certificates')
   or (bucket_id = 'photos' and name like 'players/%');

-- Remove all player registration/payment history and test registrations.
delete from public.registrations;

-- Remove player profiles, assignments, waiver flags, payment references, and roster data.
delete from public.players;

-- Remove non-coach/non-admin parent profile rows.
delete from public.profiles
where id in (select id from reset_parent_ids);

-- Remove Supabase Auth users for parents so the same email can register again.
delete from auth.users
where id in (select id from reset_auth_user_ids);

commit;

notify pgrst, 'reload schema';

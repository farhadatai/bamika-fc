-- =============================================================================
-- SECURITY FIX: stop any logged-in user from promoting themselves to admin
-- and from editing other people's profiles.
--
-- The old policy was:
--   create policy "Enable all access for authenticated users" on public.profiles
--     for all to authenticated using (true) with check (true);
-- That let ANY signed-in user update ANY profile row, including their own
-- `role` column -> instant admin. This replaces it with scoped policies.
--
-- Safe for this app because:
--  * Admin/coach actions run through the API with the service-role key, which
--    bypasses RLS entirely, so tightening client rules does not affect them.
--  * The browser only ever writes a profile for the user's OWN id with
--    role = 'user' (new-user creation and parent password setup), which the
--    new policies still allow.
--
-- HOW TO APPLY: Supabase dashboard -> SQL Editor -> paste this -> Run.
-- Reversible: re-running the old "using(true) with check(true)" policy restores
-- the prior behavior.
-- =============================================================================

alter table public.profiles enable row level security;

-- Remove the blanket policy and any older variants.
drop policy if exists "Enable all access for authenticated users" on public.profiles;
drop policy if exists "Users can view own profile"   on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

-- READ: signed-in users may read profiles (keeps the admin & coach dashboards
-- working, since they read via the browser). Anonymous visitors stay blocked.
create policy "Authenticated can read profiles"
  on public.profiles
  for select
  to authenticated
  using (true);

-- INSERT: a user may create only their OWN row, and only as a normal 'user'.
-- (Elevated roles are assigned server-side via the service key.)
create policy "Users can insert own profile as user"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid() and coalesce(role, 'user') = 'user');

-- UPDATE: a user may update only their OWN row, and may never change role to
-- anything but 'user'. This is what blocks self-promotion to admin/coach.
create policy "Users can update own profile without escalating"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = 'user');

-- No client DELETE policy: only the service-role API can delete profiles.

-- =============================================================================
-- profiles Row Level Security — complete, corrected policy set.
--
-- Run this WHOLE file in: Supabase dashboard -> SQL Editor -> New query -> Run.
-- It replaces every earlier profiles policy (including the first security fix),
-- so it is the single source of truth. Safe to re-run (idempotent).
--
-- What it guarantees:
--   * Anonymous (logged-out) visitors: no access at all.
--   * A normal member: can read/update ONLY their own row, and can NEVER
--     change their own role (blocks self-promotion to admin/coach).
--   * Admins: can read and write every profile (needed by the admin dashboard,
--     e.g. "make this parent a coach", editing parents).
--   * Coaches/parents: can update their own row (e.g. profile photo) as long
--     as they don't change their role.
--   * The server API uses the service-role key, which bypasses RLS entirely,
--     so server-side admin actions keep working regardless.
-- =============================================================================

alter table public.profiles enable row level security;

-- Helper: is the current user an admin?
-- SECURITY DEFINER so it reads profiles WITHOUT triggering RLS again
-- (prevents infinite recursion when used inside a profiles policy).
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Drop every prior policy variant so we start from a known state.
drop policy if exists "Enable all access for authenticated users"        on public.profiles;
drop policy if exists "Authenticated can read profiles"                  on public.profiles;
drop policy if exists "Users can insert own profile as user"             on public.profiles;
drop policy if exists "Users can update own profile without escalating"  on public.profiles;
drop policy if exists "Users can view own profile"                       on public.profiles;
drop policy if exists "Users can insert own profile"                     on public.profiles;
drop policy if exists "Users can update own profile"                     on public.profiles;
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;
drop policy if exists "profiles_delete" on public.profiles;

-- READ: your own row, or everything if you are an admin.
create policy "profiles_select" on public.profiles
  for select to authenticated
  using ( id = auth.uid() or public.is_admin() );

-- INSERT: create only your own row as a normal 'user'; admins may create any.
create policy "profiles_insert" on public.profiles
  for insert to authenticated
  with check (
    public.is_admin()
    or (id = auth.uid() and coalesce(role, 'user') = 'user')
  );

-- UPDATE: admins may update anyone. A normal user may update only their own
-- row, and the new role must equal their CURRENT stored role — so they can
-- edit their name/photo/phone but can never escalate their own role.
create policy "profiles_update" on public.profiles
  for update to authenticated
  using ( public.is_admin() or id = auth.uid() )
  with check (
    public.is_admin()
    or (
      id = auth.uid()
      and role = (select p.role from public.profiles p where p.id = auth.uid())
    )
  );

-- DELETE: admins only (the service-role API also bypasses RLS).
create policy "profiles_delete" on public.profiles
  for delete to authenticated
  using ( public.is_admin() );

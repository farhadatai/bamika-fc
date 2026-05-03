-- Required player registration fields and parent write access.
-- Safe to run more than once in Supabase SQL Editor.

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
alter table public.players add column if not exists created_at timestamptz default now();

alter table public.registrations add column if not exists stripe_customer_id text;

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

alter table public.players enable row level security;

drop policy if exists "Parents can insert own players" on public.players;
drop policy if exists "Parents can update own pending players" on public.players;
drop policy if exists "Parents can view own players" on public.players;

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

grant select, insert, update on public.players to authenticated;

notify pgrst, 'reload schema';

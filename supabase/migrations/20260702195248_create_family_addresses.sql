-- One secure family mailing address per parent profile. Players inherit this
-- address through players.parent_id when the GotSport CSV is generated.
create table if not exists public.family_addresses (
  parent_id uuid primary key references public.profiles(id) on delete cascade,
  address text not null,
  city text not null,
  state text not null,
  zip text not null,
  updated_at timestamptz not null default now(),
  constraint family_addresses_address_required check (length(btrim(address)) > 0),
  constraint family_addresses_city_required check (length(btrim(city)) > 0),
  constraint family_addresses_state_required check (length(btrim(state)) between 2 and 50),
  constraint family_addresses_zip_format check (zip ~ '^\d{5}(-\d{4})?$')
);

alter table public.family_addresses enable row level security;

grant select, insert, update, delete on public.family_addresses to authenticated;

drop policy if exists "family_addresses_select" on public.family_addresses;
drop policy if exists "family_addresses_insert" on public.family_addresses;
drop policy if exists "family_addresses_update" on public.family_addresses;
drop policy if exists "family_addresses_delete" on public.family_addresses;

create policy "family_addresses_select" on public.family_addresses
  for select to authenticated
  using (
    parent_id = (select auth.uid())
    or exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  );

create policy "family_addresses_insert" on public.family_addresses
  for insert to authenticated
  with check (
    parent_id = (select auth.uid())
    or exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  );

create policy "family_addresses_update" on public.family_addresses
  for update to authenticated
  using (
    parent_id = (select auth.uid())
    or exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  )
  with check (
    parent_id = (select auth.uid())
    or exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  );

create policy "family_addresses_delete" on public.family_addresses
  for delete to authenticated
  using (
    parent_id = (select auth.uid())
    or exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  );

notify pgrst, 'reload schema';

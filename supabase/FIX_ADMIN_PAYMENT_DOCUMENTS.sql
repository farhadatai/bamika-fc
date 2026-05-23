-- Bamika FC admin payment/document tracking repair.
-- Safe to run more than once in Supabase SQL Editor.

alter table public.players add column if not exists payment_status text default 'pending';
alter table public.players add column if not exists status text default 'pending';
alter table public.players add column if not exists stripe_subscription_id text;
alter table public.players add column if not exists stripe_customer_id text;
alter table public.players add column if not exists uniform_purchased boolean default false;
alter table public.players add column if not exists uniform_confirmation_code text;
alter table public.players add column if not exists waiver_signed boolean default false;

alter table public.registrations add column if not exists player_id uuid;
alter table public.registrations add column if not exists checkout_player_id uuid;
alter table public.registrations add column if not exists parent_id uuid;
alter table public.registrations add column if not exists payment_status text default 'pending';
alter table public.registrations add column if not exists status text default 'pending';
alter table public.registrations add column if not exists stripe_subscription_id text;
alter table public.registrations add column if not exists stripe_customer_id text;
alter table public.registrations add column if not exists uniform_purchased boolean default false;
alter table public.registrations add column if not exists uniform_confirmation_code text;
alter table public.registrations add column if not exists birth_cert_path text default 'not_provided';

create index if not exists idx_registrations_player_lookup
  on public.registrations(player_id, checkout_player_id, parent_id);

create index if not exists idx_players_payment_status
  on public.players(payment_status, status);

insert into storage.buckets (id, name, public)
values ('birth_certificates', 'birth_certificates', false)
on conflict (id) do nothing;

drop policy if exists "Admins can manage birth certificates" on storage.objects;
create policy "Admins can manage birth certificates"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'birth_certificates'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
)
with check (
  bucket_id = 'birth_certificates'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);

grant select, insert, update on public.registrations to authenticated;
grant select, update on public.players to authenticated;

notify pgrst, 'reload schema';

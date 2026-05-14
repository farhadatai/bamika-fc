-- Track optional uniform purchases from Stripe checkout.
-- Safe to run more than once in Supabase SQL Editor.

alter table public.players add column if not exists uniform_purchased boolean default false;
alter table public.players add column if not exists uniform_confirmation_code text;

alter table public.registrations add column if not exists uniform_purchased boolean default false;
alter table public.registrations add column if not exists uniform_confirmation_code text;

notify pgrst, 'reload schema';

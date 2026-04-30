-- Keep player registrations, Stripe checkout, and roster status connected.
alter table public.registrations add column if not exists player_id uuid references public.players(id) on delete set null;
alter table public.registrations add column if not exists jersey_size text;
alter table public.registrations add column if not exists stripe_customer_id text;
alter table public.registrations add column if not exists photo_url text;
alter table public.registrations add column if not exists position text default 'TBD';
alter table public.registrations add column if not exists payment_status text default 'pending';

alter table public.players add column if not exists status text default 'pending_payment';
alter table public.players add column if not exists payment_status text default 'pending';

create index if not exists registrations_player_id_idx on public.registrations(player_id);

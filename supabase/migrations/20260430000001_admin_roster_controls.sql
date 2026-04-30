-- Admin roster controls for coach-family management.
alter table public.players add column if not exists position text default 'TBD';
alter table public.players add column if not exists jersey_number text default '-';
alter table public.players add column if not exists payment_status text default 'pending';
alter table public.players add column if not exists status text default 'pending_payment';

alter table public.coaches add column if not exists bio text;
alter table public.coaches add column if not exists is_published boolean default true;

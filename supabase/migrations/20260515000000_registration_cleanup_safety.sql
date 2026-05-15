-- Safer registration cleanup relationships for Bamika FC.
-- This does not delete data. It makes future parent/player deletion cleaner.

alter table public.registrations add column if not exists player_id uuid;
alter table public.registrations add column if not exists parent_id uuid;
alter table public.registrations add column if not exists payment_status text default 'pending';
alter table public.registrations add column if not exists status text default 'pending';
alter table public.registrations add column if not exists stripe_subscription_id text;
alter table public.registrations add column if not exists stripe_customer_id text;

do $$
declare
  constraint_name text;
begin
  select tc.constraint_name
  into constraint_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'registrations'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'player_id'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.registrations drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.registrations
  add constraint registrations_player_id_fkey
  foreign key (player_id)
  references public.players(id)
  on delete cascade
  not valid;

do $$
declare
  constraint_name text;
begin
  select tc.constraint_name
  into constraint_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'registrations'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'parent_id'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.registrations drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.registrations
  add constraint registrations_parent_id_fkey
  foreign key (parent_id)
  references public.profiles(id)
  on delete cascade
  not valid;

create index if not exists idx_players_parent_full_name_status
  on public.players(parent_id, full_name, status);

create index if not exists idx_registrations_parent_player
  on public.registrations(parent_id, player_id);

create index if not exists idx_registrations_payment_status
  on public.registrations(payment_status, status);

notify pgrst, 'reload schema';

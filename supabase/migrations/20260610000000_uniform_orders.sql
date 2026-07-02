-- Track uniform purchases separately from player registration checkout.

create table if not exists public.uniform_orders (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.profiles(id) on delete set null,
  player_id uuid references public.players(id) on delete set null,
  player_name text not null,
  parent_name text,
  parent_email text,
  parent_phone text,
  jersey_size text,
  jersey_number text,
  team_assigned text,
  amount_cents integer not null default 10000,
  currency text not null default 'usd',
  status text not null default 'pending_payment',
  payment_status text not null default 'pending',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  confirmation_code text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_uniform_orders_parent_id
  on public.uniform_orders(parent_id);

create index if not exists idx_uniform_orders_player_id
  on public.uniform_orders(player_id);

create index if not exists idx_uniform_orders_payment_status
  on public.uniform_orders(payment_status, status);

alter table public.uniform_orders enable row level security;

drop policy if exists "Parents can view own uniform orders" on public.uniform_orders;
drop policy if exists "Parents can insert own uniform orders" on public.uniform_orders;
drop policy if exists "Admins can manage uniform orders" on public.uniform_orders;

create policy "Parents can view own uniform orders" on public.uniform_orders
  for select to authenticated
  using (parent_id = auth.uid());

create policy "Parents can insert own uniform orders" on public.uniform_orders
  for insert to authenticated
  with check (parent_id = auth.uid());

create policy "Admins can manage uniform orders" on public.uniform_orders
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

grant select, insert, update, delete on public.uniform_orders to authenticated;

notify pgrst, 'reload schema';

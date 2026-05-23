-- Public sponsor inquiry requests from the homepage.
create table if not exists public.sponsor_requests (
  id uuid default gen_random_uuid() primary key,
  business_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  message text,
  status text not null default 'new',
  created_at timestamptz default now()
);

alter table public.sponsor_requests add column if not exists business_name text;
alter table public.sponsor_requests add column if not exists contact_name text;
alter table public.sponsor_requests add column if not exists email text;
alter table public.sponsor_requests add column if not exists phone text;
alter table public.sponsor_requests add column if not exists message text;
alter table public.sponsor_requests add column if not exists status text not null default 'new';
alter table public.sponsor_requests add column if not exists created_at timestamptz default now();

alter table public.sponsor_requests enable row level security;

drop policy if exists "Anyone can submit sponsor requests" on public.sponsor_requests;
drop policy if exists "Admins can manage sponsor requests" on public.sponsor_requests;

create policy "Anyone can submit sponsor requests" on public.sponsor_requests
  for insert
  with check (true);

create policy "Admins can manage sponsor requests" on public.sponsor_requests
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

grant insert on public.sponsor_requests to anon, authenticated;
grant select, update, delete on public.sponsor_requests to authenticated;

notify pgrst, 'reload schema';

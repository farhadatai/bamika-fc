-- Player recognition and sponsor promotion spotlights.
-- Run this in Supabase SQL Editor, then refresh the website.

create table if not exists public.recognition_items (
  id uuid default gen_random_uuid() primary key,
  type text not null default 'player',
  title text not null,
  subtitle text,
  body text not null,
  image_url text,
  link_url text,
  is_published boolean not null default true,
  created_at timestamptz default now()
);

alter table public.recognition_items add column if not exists type text not null default 'player';
alter table public.recognition_items add column if not exists title text;
alter table public.recognition_items add column if not exists subtitle text;
alter table public.recognition_items add column if not exists body text;
alter table public.recognition_items add column if not exists image_url text;
alter table public.recognition_items add column if not exists link_url text;
alter table public.recognition_items add column if not exists is_published boolean not null default true;
alter table public.recognition_items add column if not exists created_at timestamptz default now();

alter table public.recognition_items enable row level security;

drop policy if exists "Public can view published recognition items" on public.recognition_items;
drop policy if exists "Admins can manage recognition items" on public.recognition_items;

create policy "Public can view published recognition items" on public.recognition_items
  for select
  using (
    is_published = true
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can manage recognition items" on public.recognition_items
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

grant select on public.recognition_items to anon, authenticated;
grant insert, update, delete on public.recognition_items to authenticated;

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can view spotlight photos" on storage.objects;
drop policy if exists "Authenticated users can upload spotlight photos" on storage.objects;

create policy "Public can view spotlight photos" on storage.objects
  for select
  using (bucket_id = 'photos');

create policy "Authenticated users can upload spotlight photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos');

notify pgrst, 'reload schema';

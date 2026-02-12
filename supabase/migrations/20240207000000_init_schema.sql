-- Create profiles table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text,
  phone text,
  created_at timestamptz default now()
);

-- Create registrations table
create table if not exists public.registrations (
  id uuid default gen_random_uuid() primary key,
  parent_id uuid references public.profiles(id) on delete cascade not null,
  first_name text not null,
  last_name text not null,
  dob date not null,
  gender text not null,
  birth_cert_path text not null,
  waiver_signed_at timestamptz not null,
  medical_conditions text,
  stripe_subscription_id text,
  status text default 'pending',
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.registrations enable row level security;

-- Policies for Profiles
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Policies for Registrations
create policy "Parents can view their own children" on public.registrations
  for select using (auth.uid() = parent_id);

create policy "Parents can insert registration" on public.registrations
  for insert with check (auth.uid() = parent_id);

-- Create Storage Bucket for Birth Certificates if it doesn't exist
insert into storage.buckets (id, name, public)
values ('birth_certificates', 'birth_certificates', false)
on conflict (id) do nothing;

-- Storage Policies
-- Allow authenticated users to upload files to the birth_certificates bucket
create policy "Authenticated users can upload birth certs"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'birth_certificates' AND
  auth.uid() = owner
);

-- Allow users to view their own uploaded files
create policy "Users can view own birth certs"
on storage.objects for select
to authenticated
using (
  bucket_id = 'birth_certificates' AND
  auth.uid() = owner
);

-- Create a function to check if a user is an admin (optional but cleaner)
-- Or just use the condition directly in the policy

-- Policy for Admin to view all registrations
create policy "Admins can view all registrations" on public.registrations
  for select
  to authenticated
  using (
    auth.jwt() ->> 'email' = 'admin@bamikafc.com'
  );

-- Policy for Admin to view all profiles
create policy "Admins can view all profiles" on public.profiles
  for select
  to authenticated
  using (
    auth.jwt() ->> 'email' = 'admin@bamikafc.com'
  );

-- Policy for Admin to update registrations (to approve them)
create policy "Admins can update registrations" on public.registrations
  for update
  to authenticated
  using (
    auth.jwt() ->> 'email' = 'admin@bamikafc.com'
  );

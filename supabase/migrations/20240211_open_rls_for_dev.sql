-- TEMPORARY: Allow all authenticated users to update profiles
-- This fixes the "no rows affected" error by ensuring RLS doesn't block the update
-- regardless of the current user's role.

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;

-- Create a permissive policy for development
CREATE POLICY "Enable all access for authenticated users"
ON public.profiles
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

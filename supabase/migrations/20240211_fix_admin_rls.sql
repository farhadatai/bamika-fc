-- Enable RLS on profiles if not already enabled (it is, but good practice)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow Admins to update any profile
-- We use a subquery to check if the current user has the 'admin' role
-- NOTE: This assumes there is a policy allowing users to SELECT from profiles!
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Also allow Admins to read all profiles (if not already allowed)
CREATE POLICY "Admins can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  true
);

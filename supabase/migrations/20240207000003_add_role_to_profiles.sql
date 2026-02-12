-- Add role column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';

-- Helper function to get the current user's role (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Policy for Coaches to view active registrations
CREATE POLICY "Coaches can view active registrations" ON public.registrations
  FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'coach'
    AND status = 'active'
  );

-- Policy for Coaches to view profiles (parents of players)
CREATE POLICY "Coaches can view profiles" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'coach'
  );

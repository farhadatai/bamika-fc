-- Add coach_id to registrations table
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS coach_id uuid references auth.users(id);

-- Update Coach Policy to only see their own assigned players
DROP POLICY IF EXISTS "Coaches can view active registrations" ON public.registrations;

CREATE POLICY "Coaches can view assigned players" ON public.registrations
  FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'coach'
    AND coach_id = auth.uid()
  );

-- Admin can update coach_id
CREATE POLICY "Admins can assign coaches" ON public.registrations
  FOR UPDATE
  TO authenticated
  USING (
    public.get_my_role() = 'admin' OR auth.jwt() ->> 'email' = 'admin@bamikafc.com'
  );

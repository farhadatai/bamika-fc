-- Allow Admins to insert into profiles (needed for Create Coach form)
CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_my_role() = 'admin'
  );

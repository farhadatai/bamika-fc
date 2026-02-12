-- Add manual registration support columns
ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS manual_parent_name text,
ADD COLUMN IF NOT EXISTS manual_phone text;

-- Make parent_id nullable if it isn't already (usually is, but good to ensure)
ALTER TABLE public.registrations 
ALTER COLUMN parent_id DROP NOT NULL;

-- Update RLS to allow Admins to insert registrations without being the parent
CREATE POLICY "Admins can insert manual registrations" ON public.registrations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_my_role() = 'admin' OR auth.jwt() ->> 'email' = 'admin@bamikafc.com'
  );

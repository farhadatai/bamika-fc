-- Add photo_url columns
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_url text;

-- Create 'photos' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
-- 1. Public Read Access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'photos' );

-- 2. Authenticated Upload Access
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'photos' );

-- 3. Users can update their own photos (for coaches/profiles)
CREATE POLICY "Users can update own photos"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1] );

-- 4. Admins can do everything
CREATE POLICY "Admins All Access"
ON storage.objects FOR ALL
TO authenticated
USING ( 
  bucket_id = 'photos' 
  AND (public.get_my_role() = 'admin' OR auth.jwt() ->> 'email' = 'admin@bamikafc.com')
);

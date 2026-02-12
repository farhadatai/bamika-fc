-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.registrations TO authenticated;

-- Grant permissions to anon users (if needed for public access, but kept minimal here)
GRANT SELECT ON public.profiles TO anon; 

-- Ensure storage permissions are set (usually handled by RLS, but good to ensure role access)
GRANT ALL ON TABLE storage.objects TO authenticated;
GRANT ALL ON TABLE storage.buckets TO authenticated;

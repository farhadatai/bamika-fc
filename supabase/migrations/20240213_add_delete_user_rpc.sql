-- Create a function to delete a user account
-- This function needs to be SECURITY DEFINER to access auth.users
CREATE OR REPLACE FUNCTION delete_user_account(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Delete from public.coaches if exists
  DELETE FROM public.coaches WHERE id = target_user_id;
  
  -- Delete from public.profiles if exists (usually cascades from auth.users but being explicit)
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

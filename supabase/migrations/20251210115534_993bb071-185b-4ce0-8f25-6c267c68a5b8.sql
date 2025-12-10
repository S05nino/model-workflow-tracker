-- Drop the existing public read policy on app_config
DROP POLICY IF EXISTS "Public read access for app_config" ON public.app_config;

-- Create a secure password validation function using SECURITY DEFINER
-- This validates the password server-side without exposing the actual value
CREATE OR REPLACE FUNCTION public.validate_shared_password(input_password text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_config
    WHERE key = 'shared_password'
      AND value = input_password
  )
$$;
-- Add explicit RLS policy to app_config that denies all direct access
-- The validate_shared_password function uses SECURITY DEFINER so it bypasses RLS
-- This ensures the table data is never directly accessible

CREATE POLICY "No direct access to app_config" 
ON public.app_config 
FOR ALL 
USING (false)
WITH CHECK (false);
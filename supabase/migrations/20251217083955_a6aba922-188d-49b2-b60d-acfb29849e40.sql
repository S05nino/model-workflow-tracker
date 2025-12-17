-- Add RLS policy for app_config that blocks direct access
-- The validate_shared_password function uses SECURITY DEFINER so it bypasses RLS

CREATE POLICY "Block direct access to app_config" 
ON public.app_config 
FOR ALL 
TO public
USING (false)
WITH CHECK (false);
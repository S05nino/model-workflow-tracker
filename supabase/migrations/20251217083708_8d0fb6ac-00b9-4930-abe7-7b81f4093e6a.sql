-- Update RLS policies to require authentication

-- Drop existing public policies
DROP POLICY IF EXISTS "Public access for projects" ON public.projects;
DROP POLICY IF EXISTS "Public access for releases" ON public.releases;
DROP POLICY IF EXISTS "Public access for release_models" ON public.release_models;

-- Create new policies requiring authentication
CREATE POLICY "Authenticated users can manage projects" 
ON public.projects 
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can manage releases" 
ON public.releases 
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can manage release_models" 
ON public.release_models 
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Keep app_config accessible for password validation (anon can call the function)
DROP POLICY IF EXISTS "No direct access to app_config" ON public.app_config;
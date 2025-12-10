-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country TEXT NOT NULL,
  segment TEXT NOT NULL,
  test_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'info-received',
  current_round INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create releases table
CREATE TABLE public.releases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL,
  target_date DATE NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create release_models table (models associated with releases)
CREATE TABLE public.release_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  release_id UUID NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  segment TEXT NOT NULL,
  is_included BOOLEAN NOT NULL DEFAULT true,
  is_confirmed BOOLEAN NOT NULL DEFAULT false,
  model_out_id TEXT,
  model_in_id TEXT,
  rules_out_id TEXT,
  rules_in_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create app_config table for storing shared password hash
CREATE TABLE public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Enable RLS on all tables (but allow public access since we use shared password)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Allow public read/write access (protected by app-level password)
CREATE POLICY "Public access for projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for releases" ON public.releases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for release_models" ON public.release_models FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read access for app_config" ON public.app_config FOR SELECT USING (true);

-- Insert default password (changeme - users should change this)
INSERT INTO public.app_config (key, value) VALUES ('shared_password', 'team2024');

-- Create indexes for better performance
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_release_models_release_id ON public.release_models(release_id);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.releases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.release_models;
// Database client factory - switches between Supabase and Local JSON
import { supabase } from '@/integrations/supabase/client';
import { localClient } from '@/integrations/local/client';

// Check if we're running in local/Docker mode
const isLocalMode = !!import.meta.env.VITE_API_URL;

// Export the appropriate client
export const db = isLocalMode ? localClient : supabase;

// Type exports for convenience
export type { Database } from '@/integrations/supabase/types';

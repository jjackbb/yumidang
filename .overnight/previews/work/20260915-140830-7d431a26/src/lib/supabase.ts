import { createClient } from '@supabase/supabase-js';
import { externalServicesBlocked } from '../utils/demoMode';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hrhudubhmazqevnrfsmo.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyaHVkdWJobWF6cWV2bnJmc21vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMzI1MzIsImV4cCI6MjEwNDkwODUzMn0.IOBJa5_UaEsloS7KJir7bJLqk_jfnGgRKegfr6RgxYg';

// The existing integration stays intact; the explicit demo never restores or refreshes a real session.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, externalServicesBlocked()
  ? { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  : undefined);

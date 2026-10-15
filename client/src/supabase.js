import { createClient } from '@supabase/supabase-js';

// Read from Vite environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
// Or fallback to dummy values if not provided so app doesn't crash before user configures .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

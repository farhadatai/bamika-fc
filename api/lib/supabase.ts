import { createClient } from '@supabase/supabase-js';

// Flexible environment variable loading
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

// Explicit error handling
if (!supabaseUrl) {
  console.error(
    'Supabase URL is not set. Please add VITE_SUPABASE_URL or SUPABASE_URL to your environment variables.'
  );
  throw new Error('Supabase URL not configured');
}

if (!supabaseServiceKey) {
  console.error(
    'Supabase service key is not set. Please add SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, or VITE_SUPABASE_ANON_KEY to your environment variables.'
  );
  throw new Error('Supabase service key not configured');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

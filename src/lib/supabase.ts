import { createClient } from '@supabase/supabase-js';

// The publishable Supabase key is safe to ship to the browser. Environment
// variables remain the preferred deployment configuration; the fallback keeps
// the production Vercel build functional when its environment variables were
// not attached to the project.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ypfrlglzblxcsilzkomx.supabase.co';
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_IA0LhNF6h_0g9VH1E1JaMw_TysZu4eq';

export const supabase = createClient(url, publishableKey);

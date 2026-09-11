import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://demo.invalid',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'demo-key',
);

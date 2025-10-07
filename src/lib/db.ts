import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lazy-initialized clients to avoid throwing at module load when env is missing (e.g., local tests)
let _admin: SupabaseClient | null = null;
let _anon: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !serviceKey) return null;
  _admin = createClient(url, serviceKey);
  return _admin;
}

export function getSupabase(): SupabaseClient | null {
  if (_anon) return _anon;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  _anon = createClient(url, anon);
  return _anon;
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client for the browser using Vite env vars.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (cachedClient != null) {
    return cachedClient;
  }
  const supabaseUrl: string | undefined = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey: string | undefined =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl?.trim() || !supabaseKey?.trim()) {
    throw new Error(
      "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY). Copy team-lookup/.env.example to team-lookup/.env.local.",
    );
  }
  cachedClient = createClient(supabaseUrl.trim(), supabaseKey.trim());
  return cachedClient;
}

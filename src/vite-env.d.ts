/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string | undefined;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string | undefined;
  readonly VITE_SUPABASE_ANON_KEY: string | undefined;
  readonly VITE_SUPABASE_TEAM_TABLE: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

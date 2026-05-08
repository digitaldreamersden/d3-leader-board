/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string | undefined;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string | undefined;
  readonly VITE_SUPABASE_ANON_KEY: string | undefined;
  readonly VITE_SUPABASE_TEAM_TABLE: string | undefined;
  readonly VITE_COMMUNITY_NAME: string | undefined;
  readonly VITE_COMMUNITY_ABBREV: string | undefined;
  readonly VITE_BRAND_TAGLINE: string | undefined;
  readonly VITE_BRAND_HEADLINE: string | undefined;
  readonly VITE_EVENT_ABOUT_HEADING: string | undefined;
  readonly VITE_EVENT_TITLE: string | undefined;
  readonly VITE_EVENT_INTRO: string | undefined;
  readonly VITE_SUCCESS_EMOJI: string | undefined;
  readonly VITE_COMMUNITY_SITE_URL: string | undefined;
  readonly VITE_COMMUNITY_EVENTS_URL: string | undefined;
  readonly VITE_SUPPORT_EMAIL: string | undefined;
  readonly VITE_BRAND_LOGO_SRC: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

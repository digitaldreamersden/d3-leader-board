# Team lookup (meetup mini-app)

Small **Vite + React** SPA for participants: enter a registered email, see **only their team name**. Deploy separately from the main leaderboard app; Supabase client code lives entirely under `team-lookup/`.

## Environment variables

Copy `.env.example` to `.env.local` (or configure the same variables on your host).

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Project URL (`https://<ref>.supabase.co`). |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes* | Publishable API key (Project Settings → API). |
| `VITE_SUPABASE_ANON_KEY` | Yes* | Legacy anon key; used if publishable key is unset. |
| `VITE_SUPABASE_TEAM_TABLE` | No | Table name; defaults to `leaderboard_team_members` (same as organizer sync). |
| `VITE_EVENT_TITLE` | No | Main heading on the page. |

\* Provide **either** `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY`.

## Local development

```bash
cd team-lookup
npm install
npm run dev
```

Open the URL shown (default dev server port **5174**).

## Production build

```bash
cd team-lookup
npm run build
```

Static assets are written to `team-lookup/dist/`. Serve that folder on any static host (Vercel, Netlify, Cloudflare Pages, S3, etc.) and set the same `VITE_*` variables in the hosting dashboard.

## Supabase access (RLS)

This app queries **one row** with:

- `select('team')`
- `eq('email', <normalized email>)`  
  (same trim + lowercase behavior as the organizer upload in the main app.)

The browser uses the **anon/publishable** key. For the query to succeed, **Row Level Security** on `leaderboard_team_members` must allow `SELECT` for the `anon` role in a way that PostgREST can satisfy.

Typical options:

1. **Permissive read for the event** — e.g. a policy that allows `SELECT` for `anon` on this table. **Note:** anyone with the anon key can still script a full-table export if RLS allows reading every row; your product decision was that knowing an email is enough to learn a team, not that the table must stay secret from automated clients.
2. **Stricter** — use a `SECURITY DEFINER` RPC that returns only `team` for a given email and grant `EXECUTE` to `anon`, with RLS denying direct `SELECT` on the table. This mini-app would then call `rpc(...)` instead of `from(...).select(...)`.

If lookups fail with a permission-style error, adjust policies or add an RPC, then redeploy.

## Branding

Visual tokens follow the Digital Dreamers Den brief (navy base, electric blue, orange CTA). Adjust CSS variables in `src/index.css` if needed.

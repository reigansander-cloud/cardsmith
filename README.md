# CardSmith

Card designer, clan database and Play Clans table. It's a React (Vite) site
hosted on GitHub Pages, with data, logins, live updates and uploads on Supabase.

**Moving from Base44? Follow [MIGRATION.md](MIGRATION.md).**

## Run it locally

```
npm install
cp .env.example .env.local   # fill in your Supabase URL and anon key
npm run dev
```

## How it's put together

| Piece | Where |
|---|---|
| Data / login / uploads client (same `base44.*` calls the app always used) | `src/api/base44Client.js`, `src/api/compat.js` |
| What the old Base44 server functions did | `src/api/serverFunctions.js` |
| Play Clans syncing (versioned, conflict-free merging) | `src/lib/gameSync.js`, `src/lib/versionedMerge.js`, `src/hooks/useGame.js` |
| Database, permissions, live updates, file bucket | `supabase/schema.sql` |
| Deploy to GitHub Pages | `.github/workflows/deploy.yml` |
| One-off migration tools | `migration/` |

# Deploying to Railway

Everything runs on one Railway project: a **web service** (this app) + a
**Postgres** plugin. Scores update via the admin (manual) and/or the API feed.

## 1. Provision

```bash
railway login                 # already logged in as triplec47@pm.me
railway init                  # or: railway link   (to an existing project)
railway add --database postgres
```

## 2. Environment variables (Railway → service → Variables)

| Var | Value |
|-----|-------|
| `DATABASE_URL` | reference the Postgres plugin (`${{Postgres.DATABASE_URL}}`) |
| `ADMIN_PASSWORD` | a strong password **you choose** (this is the only login) |
| `SESSION_SECRET` | `openssl rand -base64 32` |
| `CRON_SECRET` | `openssl rand -base64 32` |
| `SCORE_PROVIDER` | `manual` to start; `apifootball` once you have a key |
| `APIFOOTBALL_KEY` | from dashboard.api-football.com (free tier covers the World Cup) |
| `APIFOOTBALL_LEAGUE` | `1` (World Cup) · `APIFOOTBALL_SEASON` `2026` |
| `NEXT_PUBLIC_SITE_NAME` | `2026 World Cup Bracket` |

## 3. Deploy

```bash
railway up
```

Build runs `prisma generate` (postinstall) + `next build`. Start runs
`prisma migrate deploy` then `next start`. Health check: `/api/health`.

## 4. Seed reference data (once)

```bash
railway run pnpm db:seed     # 48 teams + 72 fixtures
```

## 5. Enter the pool

- Open `/admin`, sign in with `ADMIN_PASSWORD`.
- **Players** → add everyone. **Picks** → enter each bracket. Lock at kickoff.
- Share the public URL (root `/`) with the group — no login needed.

## 6. Auto score updates (optional, recommended)

Manual entry already auto-updates the board. To automate via the API, set
`SCORE_PROVIDER=apifootball` + `APIFOOTBALL_KEY`, then schedule the sync:

- **Railway cron service** running `pnpm sync` every ~1–2 min during matches, **or**
- any scheduler hitting `POST /api/cron/sync` with header
  `Authorization: Bearer $CRON_SECRET`.

First run links each API fixture to our match (stored as `externalRef`); check
the logs for any `unmatched` fixtures and add a name alias in
`src/lib/feed/match.ts` if needed.

## Backups

Enable automated backups on the Railway Postgres plugin. For a manual dump:
`railway run pg_dump $DATABASE_URL > backup.sql`.

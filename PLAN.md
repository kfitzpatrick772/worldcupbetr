# 2026 World Cup Bracket — Build Plan

A website for a friendly (no-gambling) World Cup pool with 20+ non-tech-savvy
participants. Public read-only board that auto-updates live; one private admin
cockpit. Tournament kicks off **June 11, 2026**.

## Locked decisions
- **Pick entry:** the admin (you) enters everyone's picks via an admin screen.
  No in-app entry by friends, no Excel import. Source of truth is the database.
- **Scores:** a paid football API with a **manual admin override** fallback.
  The system is fully functional on manual entry alone; the API drops in via env.
- **Access:** the public board needs **no login**. The only auth surface is the
  admin. All security effort concentrates on that one door.

## Architecture — the sportsbook model
Three jobs that never bleed into each other:
1. **Ingest** — pull official results (API) or accept a manual entry. Only writer
   of canonical match results.
2. **Settle** — a *pure, deterministic, idempotent* scoring engine:
   `(locked picks, official results) → points`. Re-runnable anytime; corrections
   self-heal by re-settling.
3. **Serve** — a fast public read-only board that reads a pre-computed snapshot
   (never recomputes on the fly, never calls the API directly).

## Stack
- Next.js 16 (App Router) + TypeScript + React 19
- PostgreSQL — local via Docker (`docker-compose.yml`), prod via Railway
- Prisma ORM + migrations
- Tailwind v4 + design tokens ported from `reference/design-mockup.html`
- Zod validation on every admin input
- Live feed worker on Railway cron/worker; client polls ~20–30s

## Scoring rules (implemented in the engine, confirmed)
- **Group match:** correct winner/draw = 2; exact scoreline = +2 bonus (max 4). 48 matches.
- **Group advancement:** each of your two picks that finishes top-2 = +5;
  +3 if your #1 is the actual group winner; +2 if your #2 is the actual runner-up.
- **Best thirds:** each of your 8 best-third picks that actually qualifies = +5.
- **Knockouts (set-membership):** roundValue × (your predicted survivors ∩ actual
  survivors). R32=10, R16=20, QF=40, SF=80.
- **Third-place match winner:** 40.
- **Final:** correct champion = 160; correct runner-up = +40 bonus.

## Public UX (tabs, mobile-first, neon)
1. **Leaderboard** — rank, total points, live ▲▼ movement.
2. **Matches / Live** — fixtures by stage with live scores. Click a match →
   drill-down: every participant's pick for that match + live points earned +
   their current rank.
3. **Player** — full bracket, points per item, max points still possible.
4. **Bracket / Groups** — predicted vs actual.

Design: black-green background, neon lime accent, gold champion/leader,
Anton display + Spline Sans body, tabular-numeric figures.

## Admin (the only login)
Participants CRUD · guided pick-entry mirroring the bracket · lock control
(locks all picks at kickoff, stores snapshot) · manual score override (same
settlement path, audited) · settlement dashboard + audit log.

## Security & safety
Public surface strictly read-only. API keys server-side only (Railway secrets).
Admin writes: Zod-validated, CSRF-protected, rate-limited, secure session cookie.
Idempotent settlement + audit log = tamper-evident and recoverable. Picks locked
at kickoff. DB backups, least-privilege DB user, HTTPS, security headers/CSP.

## Phases (see task list)
0. Scaffold, design system, DB, first commit ← in progress
1. Data model + seed from Excel
2. Deterministic scoring engine + tests
3. Admin panel
4. Public board
5. Live scores feed + auto-update
6. Hardening, deploy to Railway, dry run

## Notes
- `reference/` (git-ignored) holds the source Excel and the original design mockup.
- This is Next.js 16 with breaking changes vs. older versions — consult
  `node_modules/next/dist/docs/` before writing route/page code.

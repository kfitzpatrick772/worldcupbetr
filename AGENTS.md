<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 2026 World Cup Bracket — project orientation

- **What this is:** a public read-only live scoreboard + bracket for a friendly
  World Cup pool, plus one private admin cockpit. See [PLAN.md](./PLAN.md).
- **Next.js 16 quick reference:** [docs/NEXT16_NOTES.md](./docs/NEXT16_NOTES.md)
  (digest of the bundled docs — async `params`/`cookies`/`headers`, uncached
  `fetch` by default, Tailwind v4 `@theme`, typed route helpers).
- **DB:** Postgres. Local via `docker compose up -d` (see `docker-compose.yml`);
  prod via Railway. Connection in `.env` (git-ignored) — copy from `.env.example`.
- **Design system:** neon-on-black tokens in `src/app/globals.css`
  (`bg-bg`, `text-ink`, `text-lime`, `font-display`, `.tnum`). Source mockup at
  `reference/design-mockup.html` (git-ignored).
- **Architecture:** Ingest → Settle (pure, idempotent scoring) → Serve (cached
  snapshot). Never recompute on the serve path; never call the score API from it.

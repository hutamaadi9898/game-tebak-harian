# Launch Plan — "Siapa Lebih Tua?" (Indonesian Public Figures)

## Phase 0 — MVP (ship fast)
- [x] Data pipeline ready
  - [x] Write `scripts/fetch-wikidata.ts` to pull clean pool (qid, names, birthDate/year, image, occupation, attribution)
  - [x] Validate with `zod`; drop missing DOB; de-dupe by QID and (name + birthYear)
  - [x] Export `data/people.json` (public-safe fields only)
  - [x] **Update**: Filter for Indonesian citizens (wd:Q252)
- [x] Daily matchups delivery
  - [x] Pick strategy: deterministic seed via KV secret (preferred) or pregen to R2 (30–60 days)
  - [x] Implement age-gap bucketing (easy/medium/hard) and shuffle mix (2 hard, 2 medium, 1 easy)
  - [x] Add lightweight fun-fact string per person from Wikidata fields
- [x] Edge API (/api/today)
  - [x] Pages Function uses Cache API (24h) → hits R2 or deterministic generator only on cache miss
  - [x] Response shape: {date, matchups, sig}
  - [x] HMAC signing with KV secret (date + matchup IDs)
- [x] Anti-cheat + scoring (/api/score)
  - [x] Verify HMAC, reject mismatches
  - [x] Accept score payload, no writes on Free tier (log only to console for now)
- [x] Game UI (mobile-first)
  - [x] Astro page with Preact island `GameIsland` using Tailwind
  - [x] Fast “who’s older” duel flow, age reveal, confetti, share card
  - [x] LocalStorage streak + signed payload use
  - [x] **Update**: Translate UI to Indonesian
- [x] Content pages (AdSense-ready)
  - [x] about, how-to, attribution (auto from JSON), privacy, contact
  - [x] **Update**: Translate content to Indonesian
  - [x] Basic SEO: meta tags, open graph, favicons, schema.org where relevant
- [x] Deploy free
  - [x] Cloudflare Pages build config for Astro + Functions
  - [x] R2 bucket + KV namespace wired via wrangler bindings
  - [x] Add Cloudflare Web Analytics

## Phase 1 — Hardening & polish
- [x] UX polish (animations, toasts, better loading states)
- [x] Image handling: responsive sizes, blur placeholders, caching headers
- [x] Error reporting (Sentry-lite via console + CF logs)
- [x] Accessibility pass (focus, labels, color contrast)
- [x] Automated tests: generator unit tests, API contract tests

## Phase 2 — Growth & streak integrity
- [x] Durable Objects per-device streak store (SQLite)
- [x] Rate-limit /api/score with subtle backoff
- [x] Add optional email capture (edge-stored, double opt-in later)
- [x] Weekly recap/archive page (SEO + AdSense value)

## Phase 3 — Monetization & accounts
- [ ] Apply for AdSense after content base exists
- [ ] D1 for users + global leaderboard (post-traction)
- [ ] Batch raw events to R2 if needed
- [ ] Localization (id + en labels) and search index (minisearch)

## Cross-cutting guidelines
- Mobile-first layouts, sub-100KB JS on first load; prefer Preact islands
- Default to edge caching and R2 for heavy reads; keep KV reads minimal
- Comment intent in code; keep functions small; validate inputs with zod
- SEO hygiene: titles, descriptions, OG/Twitter, canonical, sitemap, robots
- Performance budget: aim for <1s TTI on mid Android; Lighthouse ≥90 mobile

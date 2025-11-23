# Senior Developer Rules (Strict)

## Non-Negotiables
- Ship mobile-first, performance-first: initial JS < **100KB** (ideal <50KB) and LCP < **2.5s** on mid Android/4G.
- Log every meaningful change in `progress.md` immediately after you do it.
- Only use `pnpm`; never `npm`/`yarn`. One logical change per commit (`type(scope): description`).
- Comment intent only where code isn’t obvious; prefer small, pure functions to comments.
- Consult Context7 MCP docs before adding dependencies; record chosen version + rationale in PR descriptions.
- Prefer R2 + Cache API for reads; keep KV reads minimal and avoid writes on the free tier unless required.

## Code Quality & Safety
- TypeScript stays strict: no `any`, no unchecked `ts-ignore`. Model state with discriminated unions and exact object types.
- Validate every external/input boundary with `zod` (API payloads, query params, KV/R2 reads). Narrow types immediately after validation.
- Avoid magic numbers/strings; extract typed constants or literal unions. Keep functions single-purpose and side-effect free where possible.
- Handle errors explicitly; never allow UI white screens. Provide user-safe fallbacks and log actionable context (no PII).
- Security hygiene: no secrets in repo, no inline tokens. Use `wrangler secret put` and `import.meta.env.*` for runtime access.

## Architecture & Performance
- Functional core, imperative shell: pure logic isolated from IO; side effects live at the edges (APIs, storage, DOM).
- Astro-first rendering: default to static HTML; use islands (`client:*`) only when interaction requires it and keep them tiny.
- Cache-first reads (SWR pattern). Prefer deterministic generation over per-request DB reads. Reuse signatures/HMAC to avoid server trust on client data.
- Image discipline: supply width/height, use `astro:assets`/Cloudflare image service, and provide responsive sizes. Budget CLS <0.1.

## UX, Accessibility & SEO
- Mobile layout starts at 320px; avoid horizontal scroll. Test keyboard navigation; every interactive element has focus styles and `aria-label` where icons are used.
- Text and UI copy default to Indonesian for user-facing surfaces; internationalize early if adding new strings.
- SEO hygiene by default: unique `<title>` + `<meta name="description">`, canonical, OG/Twitter tags, and structured data where it adds value. Noindex anything experimental.

## Data & Infrastructure
- Reads: R2 + Cache API with sane TTLs; prefer background refresh over blocking. Writes: batch and debounce; for high-consistency needs use Durable Objects/D1, not KV.
- Deterministic seeds for daily content; keep signature verification in place for score submission and reject mismatches.

## Workflow Discipline
- Keep TODOs actionable with owners or links. Delete dead code promptly.
- Run linters/tests relevant to the change; fail closed on unexpected states. Do not downgrade strictness to “make it pass”.
- If a rule conflicts with a requirement, pause and ask instead of proceeding silently.

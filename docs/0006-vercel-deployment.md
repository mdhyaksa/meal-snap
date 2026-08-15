# 6. Deployed to Vercel as `meal-snap`, publicly reachable and unauthenticated

- Status: Accepted
- Date: 2026-08-15

## Context

The app was requested as a deployed single-page site. It has no user accounts and no persistence — every analysis is a fresh upload.

## Decision

Deployed with the Vercel CLI to project `meal-snap` under `mdhyaksa-5003s-projects`:

- Production alias: `https://meal-snap-ten.vercel.app`
- `OPENROUTER_API_KEY` set for production, preview and development; `OPENROUTER_SITE_NAME` for production.
- `.vercelignore` excludes `.env`, `references/` and `wireframe/` from uploads.
- Both routes run on the Node.js runtime with `maxDuration = 120`, because analysis with web search takes ~16 s and can be slower on a complex plate.
- No authentication, no rate limiting, no persistence.

## Consequences

- **Anyone with the URL can spend the project owner's OpenRouter credits.** Each analysis is one model call with web search (search itself is billed on top of tokens); each chat turn resends the image. There is no per-IP cap and no daily ceiling.
- Mitigations available when this matters, cheapest first: a spend limit on the OpenRouter key, Vercel Deployment Protection (password or SSO) on the production deployment, or a rate limit in the route handlers keyed by IP.
- No Git remote is connected, so deploys are manual (`vercel deploy --prod`). Connecting the repo would give preview deployments per branch.
- Verified after deploy: page returns 200, `/api/analyze` rejects a non-image with 415 and returns grounded facts with 7 citations for a real photo.

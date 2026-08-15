# 5. Server-side key, validation at the boundary, stateless chat

- Status: Accepted
- Date: 2026-08-15

## Context

The browser must never hold the OpenRouter key, and the two route handlers are the only place untrusted input (an arbitrary uploaded file, arbitrary chat text) meets an upstream paid API.

## Decision

**Key.** `OPENROUTER_API_KEY` is read from `process.env` inside `lib/adapters/openrouter.ts` only. No `NEXT_PUBLIC_` prefix, so it cannot reach the client bundle. Locally it comes from a gitignored `.env` (`.env.example` is committed); in production it is a Vercel project environment variable. A missing key produces a plain "server is not configured" 500 — the environment is never echoed.

**Validation** (`app/api/_validate.ts`, shared by both routes):

| Check | Response |
|---|---|
| body larger than ~7 MB (declared or actual) | 413 |
| body not a JSON object | 400 |
| data URL not `image/png\|jpeg\|webp` + base64 | 415 |
| decoded image over 5 MB | 413 |
| more than 40 turns, or a message over 4,000 chars | 413 |

The image MIME type is checked against the data URL itself, not a client-supplied filename or `File.type` — the browser-side check in `Dropzone.tsx` is UX, not security.

**Errors.** Upstream failures surface only OpenRouter's `error.message`; request headers are never included in a response. Unexpected exceptions are logged server-side and returned as a generic message.

**Chat state.** The server is stateless: the client holds the transcript and resends `{ imageDataUrl, facts, turns }` each turn. The adapter rebuilds the message stack as system → user (image) → assistant (the on-screen label as JSON) → turns, so the model reasons off the same numbers the user is looking at.

## Consequences

- Verified in production: a `text/plain` data URL returns 415; a valid photo returns 200 with facts and citations.
- Resending the image every turn costs input tokens per message. Acceptable for a single-page tool; if it becomes expensive, cache the analysis server-side under an id and send the id instead.
- Message-count and length caps bound the request size but do not bound spend — see ADR 6.

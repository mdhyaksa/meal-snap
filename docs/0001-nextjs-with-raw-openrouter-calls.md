# 1. Next.js App Router, calling OpenRouter with raw `fetch`

- Status: Accepted
- Date: 2026-08-15

## Context

Meal Snap is a single page: upload a food photo, get a Nutrition Facts label, chat about the meal. The spec pins the model (`google/gemini-3.7-flash`), the provider routing (`google-vertex` first) and the web-search plugin — all OpenRouter-specific request fields.

An AI SDK (`ai` + a provider package) was the obvious default and was auto-suggested by tooling in this repo.

## Decision

Next.js 16 App Router with TypeScript, two route handlers (`app/api/analyze`, `app/api/chat`), and **raw `fetch` calls to `https://openrouter.ai/api/v1/chat/completions`** — no AI SDK, no provider wrapper.

Plain CSS (`app/globals.css`) rather than Tailwind: the approved wireframe (`wireframe/wireframe.html`) was already written in plain CSS, so porting it to utility classes would have been rework with no gain.

## Consequences

- `provider.order`, `plugins: [{ id: "web" }]`, `response_format.json_schema` and `reasoning.effort` are passed exactly as documented; nothing is normalised away by an abstraction layer.
- Three runtime dependencies total (`next`, `react`, `react-dom`). No lock-in to an SDK's release cadence.
- Streaming is hand-rolled: the route handler pipes the upstream SSE body straight through and `components/Chat.tsx` parses `data:` lines itself (~30 lines). `useChat` would have given this for free.
- If a second provider is ever added, the SDK question should be revisited — the current adapter is single-vendor by design.

## Verified

- The endpoint list for `google/gemini-3.7-flash` confirms `google-vertex/global` supports `response_format`, `structured_outputs` and `tools`, but **not `temperature`** — so no temperature is ever sent.

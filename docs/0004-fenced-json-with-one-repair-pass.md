# 4. Fenced JSON from a web-search call, with one strict-schema repair pass

- Status: Accepted
- Date: 2026-08-15

## Context

Analysis needs two things at once: **grounded search** (the `web` plugin, so "cheese naan nutrition facts" is actually looked up) and **structured output** (a JSON object the label can render).

Combining Google's native grounding with a strict `response_format` schema is not reliably supported — grounding and response schemas conflict on the Vertex path. Two guaranteed-correct calls (search, then convert) would double latency and cost on every upload.

## Decision

One call with `plugins: [{ id: "web" }]` and no `response_format`. The system prompt asks for a short prose summary followed by exactly one ` ```json ` fenced block, with per-field rules (bare numbers, no units, no ranges, no nulls, totals for the whole plate).

Parsing is layered:

1. Extract the fenced block; fall back to the outermost `{ … }` in the text.
2. `JSON.parse`.
3. On failure only, **one repair call**: same model, no web plugin, `response_format: { type: "json_schema", strict: true }`, input = the text that failed to parse.
4. `normalizeFacts()` coerces whatever survives — numeric strings, negatives, missing fields — so a sloppy payload degrades instead of crashing the page.

## Consequences

- Happy path is one round trip. End-to-end analysis measured at ~16 s locally and in production, including search.
- Web citations survive: `message.annotations[].url_citation` is deduped and rendered under the label. Google grounding returns `vertexaisearch.cloud.google.com` redirect URLs, so the citation **title** carries the real domain and is what the UI displays.
- The repair path costs a second call, but only when the first response is malformed.
- Prompt-shaped structure is weaker than schema-enforced structure. `normalizeFacts()` plus its tests are the safety net; if malformed responses become common, move to two calls unconditionally.

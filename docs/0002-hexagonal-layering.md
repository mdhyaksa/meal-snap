# 2. Hexagonal layering: domain, port, adapters

- Status: Accepted
- Date: 2026-08-15

## Context

`CLAUDE.md` requires hexagonal architecture "for proper testing and maintainability". The risky, slow, unstable part of this app is the LLM call; the part worth testing is the nutrition arithmetic. Those must not be entangled.

## Decision

```
lib/domain/nutrition.ts      pure: types, Daily Values, percentDV(), normalizeFacts(), fmt()
lib/ports/food-analyzer.ts   FoodAnalyzerPort interface + AnalyzerError
lib/adapters/openrouter.ts   the only file that knows OpenRouter exists
app/api/*/route.ts           inbound adapters: validate, delegate to the port, map errors
components/*                 rendering only
```

`lib/domain` imports nothing — no `fetch`, no React, no vendor types. Route handlers import the **port type** and the concrete adapter instance; swapping in a mock or a second provider means one new file implementing `FoodAnalyzerPort`.

## Consequences

- The domain is testable with no network and no mocking framework: `lib/domain/nutrition.test.ts` runs in ~40 ms under vitest.
- `AnalyzerError` carries an HTTP status so the adapter can express "429 from upstream" or "500, key missing" without route handlers inspecting vendor responses.
- Mild ceremony for a small app: the port has exactly one implementation today. Accepted because it is the boundary that will actually move (model swap, provider swap, offline mock).
- No mock adapter was written — YAGNI until someone needs to develop without a key.

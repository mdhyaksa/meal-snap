# Meal Snap

Upload a photo of a meal. Meal Snap identifies each item and its portion, web-searches real nutrition data, scales it by quantity, and renders an FDA-style Nutrition Facts label — then answers questions about that meal in chat, with the photo and the label in context.

Live: https://meal-snap-ten.vercel.app

## Run locally

```bash
npm install
cp .env.example .env      # paste your OpenRouter key
npm run dev               # http://localhost:3000
npm test                  # domain tests (vitest)
```

`OPENROUTER_API_KEY` is read server-side only and never reaches the browser.

## How it works

`google/gemini-3.7-flash` via OpenRouter, provider routing pinned to `google-vertex`, with the `web` plugin for grounded nutrition lookups. Percent Daily Values are computed locally from FDA reference values, not by the model.

```
app/api/analyze  photo  -> identify + search + total  -> NutritionFacts + citations
app/api/chat     turns  -> streamed answer (SSE passthrough)
lib/domain       pure nutrition maths, tested
lib/ports        FoodAnalyzerPort
lib/adapters     the only file that knows OpenRouter exists
```

Design decisions and their trade-offs are recorded in [`docs/`](docs/). The visual contract is [`wireframe/wireframe.html`](wireframe/wireframe.html).

## Known limits

No authentication and no rate limiting — anyone with the URL spends the deployer's OpenRouter credits. Nutrition values are photo estimates, not measurements.

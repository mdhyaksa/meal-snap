import { normalizeFacts, type NutritionFacts } from "@/lib/domain/nutrition";
import {
  AnalyzerError,
  type AnalysisResult,
  type ChatRequest,
  type Citation,
  type FoodAnalyzerPort,
} from "@/lib/ports/food-analyzer";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-3.7-flash";
/** Vertex first, per spec; fallbacks stay on so a vertex outage doesn't 500 the page. */
const PROVIDER = { order: ["google-vertex"] };

/** The vertex endpoint for this model does not advertise `temperature` — never send it. */
type OpenRouterBody = Record<string, unknown>;

const FACTS_SCHEMA = {
  type: "object",
  properties: {
    servings: { type: "number" },
    servingLabel: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string" },
          sourceQuery: { type: "string" },
        },
        required: ["name", "quantity", "unit", "sourceQuery"],
        additionalProperties: false,
      },
    },
    calories: { type: "number" },
    totalFat_g: { type: "number" },
    saturatedFat_g: { type: "number" },
    transFat_g: { type: "number" },
    unsaturatedFat_g: { type: "number" },
    cholesterol_mg: { type: "number" },
    sodium_mg: { type: "number" },
    totalCarbs_g: { type: "number" },
    fiber_g: { type: "number" },
    totalSugars_g: { type: "number" },
    addedSugars_g: { type: "number" },
    protein_g: { type: "number" },
    micronutrients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          amount: { type: "number" },
          unit: { type: "string" },
        },
        required: ["name", "amount", "unit"],
        additionalProperties: false,
      },
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    notes: { type: "string" },
  },
  required: [
    "servings",
    "servingLabel",
    "items",
    "calories",
    "totalFat_g",
    "saturatedFat_g",
    "transFat_g",
    "unsaturatedFat_g",
    "cholesterol_mg",
    "sodium_mg",
    "totalCarbs_g",
    "fiber_g",
    "totalSugars_g",
    "addedSugars_g",
    "protein_g",
    "micronutrients",
    "confidence",
    "notes",
  ],
  additionalProperties: false,
} as const;

const ANALYZE_SYSTEM = `You are a nutrition analyst. You are given a photo of a meal.

Work in this order:
1. Identify every distinct food and drink in the photo, and estimate the quantity of each as precisely as the image allows (a count for discrete items, e.g. 3 loaves of cheese naan; a portion in grams or common measures for the rest).
2. For each item, run a web search for its nutrition facts, e.g. "cheese naan nutrition facts". Prefer USDA FoodData Central, manufacturer labels, and established nutrition databases.
3. Scale each item's per-serving values by the quantity you observed (3 naan = 3x the per-naan values).
4. Sum every item into a single set of totals for the WHOLE plate shown in the photo.

Then reply with a short paragraph naming what you found and the sources you used, followed by exactly one \`\`\`json fenced code block with this shape:

{
  "servings": 1,
  "servingLabel": "whole plate (612 g)",
  "items": [{ "name": "cheese naan", "quantity": 3, "unit": "piece", "sourceQuery": "cheese naan nutrition facts" }],
  "calories": 0,
  "totalFat_g": 0, "saturatedFat_g": 0, "transFat_g": 0, "unsaturatedFat_g": 0,
  "cholesterol_mg": 0, "sodium_mg": 0,
  "totalCarbs_g": 0, "fiber_g": 0, "totalSugars_g": 0, "addedSugars_g": 0,
  "protein_g": 0,
  "micronutrients": [{ "name": "Calcium", "amount": 640, "unit": "mg" }],
  "confidence": "medium",
  "notes": "one line on what was estimated rather than looked up"
}

Rules for the JSON block:
- Every numeric field is a bare number in the unit named by the key. No units, no ranges, no strings, no nulls.
- unsaturatedFat_g is total fat minus saturated and trans fat when the source splits it out; 0 if unknown.
- micronutrients: list every vitamin or mineral your sources report, with unit "mg" or "mcg".
- Do NOT include percent daily values. They are computed downstream.
- Totals are for everything visible in the photo combined.
- If the photo contains no food, return all zeros, an empty items array, confidence "low", and say so in notes.`;

const CHAT_SYSTEM = `You are a warm, precise nutrition coach talking with someone about the meal in the attached photo.

- The nutrition label in the conversation is the shared source of truth. Quote its numbers when they matter, and do the arithmetic carefully when asked about halves, portions or swaps.
- These values are estimates from a photo. Say so when the answer hinges on precision.
- Give practical, specific, non-judgemental advice. Short paragraphs. No bullet-point walls.
- You are not a clinician: no diagnoses, no treatment advice, no claims about curing conditions. Suggest a dietitian or doctor for medical questions.`;

function apiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new AnalyzerError(
      "Server is not configured: OPENROUTER_API_KEY is missing. Copy .env.example to .env and add your key.",
      500,
    );
  }
  return key;
}

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey()}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
    "X-OpenRouter-Title": process.env.OPENROUTER_SITE_NAME ?? "Meal Snap",
  };
}

async function upstreamError(res: Response): Promise<never> {
  // Surface the provider's own message; never leak the key or our headers.
  let detail = res.statusText;
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    detail = body?.error?.message ?? detail;
  } catch {
    /* non-JSON error body */
  }
  throw new AnalyzerError(`Nutrition model request failed: ${detail}`, res.status === 429 ? 429 : 502);
}

async function complete(body: OpenRouterBody): Promise<{ text: string; citations: Citation[] }> {
  const res = await fetch(ENDPOINT, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) await upstreamError(res);

  const json = (await res.json()) as {
    choices?: {
      message?: {
        content?: string | null;
        annotations?: { type: string; url_citation?: { url: string; title: string } }[];
      };
      error?: { message?: string };
    }[];
    error?: { message?: string };
  };

  const choice = json.choices?.[0];
  const failure = json.error?.message ?? choice?.error?.message;
  if (failure) throw new AnalyzerError(`Nutrition model request failed: ${failure}`);

  const text = choice?.message?.content ?? "";
  if (!text.trim()) throw new AnalyzerError("Nutrition model returned an empty response.");

  const citations = (choice?.message?.annotations ?? [])
    .filter((a) => a.type === "url_citation" && a.url_citation?.url)
    .map((a) => ({ url: a.url_citation!.url, title: a.url_citation!.title || a.url_citation!.url }));

  return { text, citations };
}

/** Pull the JSON object out of a fenced block, or fall back to the outermost braces. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)];
  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      /* try the next candidate */
    }
  }
  throw new SyntaxError("no parseable JSON object in response");
}

function dedupe(citations: Citation[]): Citation[] {
  const seen = new Map<string, Citation>();
  for (const c of citations) if (!seen.has(c.url)) seen.set(c.url, c);
  return [...seen.values()].slice(0, 8);
}

/** Compact context line so the chat model reasons off the same numbers the label shows. */
function factsForPrompt(facts: NutritionFacts): string {
  return `Nutrition label currently on screen for this photo (totals for the whole plate):\n${JSON.stringify(facts)}`;
}

export const openRouterAnalyzer: FoodAnalyzerPort = {
  async analyze(imageDataUrl: string): Promise<AnalysisResult> {
    const { text, citations } = await complete({
      model: MODEL,
      provider: PROVIDER,
      plugins: [{ id: "web" }],
      max_tokens: 4000,
      messages: [
        { role: "system", content: ANALYZE_SYSTEM },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageDataUrl } },
            { type: "text", text: "Analyse this meal." },
          ],
        },
      ],
    });

    try {
      return { facts: normalizeFacts(extractJson(text)), citations: dedupe(citations) };
    } catch {
      // One repair pass: strict schema, no web plugin, nothing to search — just reshape.
      const repaired = await complete({
        model: MODEL,
        provider: PROVIDER,
        max_tokens: 2000,
        response_format: {
          type: "json_schema",
          json_schema: { name: "nutrition_facts", strict: true, schema: FACTS_SCHEMA },
        },
        messages: [
          {
            role: "system",
            content: "Convert the nutrition analysis below into the required JSON object. Do not invent values that are absent; use 0.",
          },
          { role: "user", content: text },
        ],
      });
      return { facts: normalizeFacts(extractJson(repaired.text)), citations: dedupe(citations) };
    }
  },

  async chat({ imageDataUrl, facts, turns }: ChatRequest): Promise<ReadableStream<Uint8Array>> {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        model: MODEL,
        provider: PROVIDER,
        stream: true,
        max_tokens: 1500,
        // Chat is conversational: keep thinking short so the first token lands fast.
        reasoning: { effort: "low" },
        messages: [
          { role: "system", content: CHAT_SYSTEM },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: imageDataUrl } },
              { type: "text", text: "This is my meal." },
            ],
          },
          { role: "assistant", content: factsForPrompt(facts) },
          ...turns,
        ],
      }),
    });

    if (!res.ok) await upstreamError(res);
    if (!res.body) throw new AnalyzerError("Nutrition model returned an empty stream.");
    return res.body;
  },
};

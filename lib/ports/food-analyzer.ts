import type { NutritionFacts } from "@/lib/domain/nutrition";

export type Citation = { url: string; title: string };

export type AnalysisResult = {
  facts: NutritionFacts;
  citations: Citation[];
};

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type ChatRequest = {
  imageDataUrl: string;
  facts: NutritionFacts;
  turns: ChatTurn[];
};

/**
 * Driven port. Route handlers depend on this; only lib/adapters/* knows a vendor exists.
 */
export interface FoodAnalyzerPort {
  /** Identify the meal in the photo, look up nutrition data, return whole-plate totals. */
  analyze(imageDataUrl: string): Promise<AnalysisResult>;
  /** Answer a question about the analysed meal. Returns an SSE stream of the raw provider chunks. */
  chat(request: ChatRequest): Promise<ReadableStream<Uint8Array>>;
}

/** Thrown by adapters for anything the user should see a sane message about. */
export class AnalyzerError extends Error {
  constructor(
    message: string,
    readonly status: number = 502,
  ) {
    super(message);
    this.name = "AnalyzerError";
  }
}

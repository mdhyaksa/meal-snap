import { assertImageDataUrl, errorResponse, readJson } from "@/app/api/_validate";
import { openRouterAnalyzer } from "@/lib/adapters/openrouter";
import { normalizeFacts } from "@/lib/domain/nutrition";
import { AnalyzerError, type ChatTurn } from "@/lib/ports/food-analyzer";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_TURNS = 40;
const MAX_CHARS = 4000;

function assertTurns(value: unknown): ChatTurn[] {
  if (!Array.isArray(value) || value.length === 0) throw new AnalyzerError("No message to answer.", 400);
  if (value.length > MAX_TURNS) throw new AnalyzerError("This conversation is too long. Start a new photo.", 413);

  return value.map((turn) => {
    const t = (turn ?? {}) as Record<string, unknown>;
    const role = t.role === "assistant" ? "assistant" : "user";
    if (typeof t.content !== "string" || !t.content.trim()) throw new AnalyzerError("Empty message.", 400);
    if (t.content.length > MAX_CHARS) throw new AnalyzerError("That message is too long.", 413);
    return { role, content: t.content } as ChatTurn;
  });
}

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const imageDataUrl = assertImageDataUrl(body.imageDataUrl);
    const turns = assertTurns(body.turns);
    const facts = normalizeFacts(body.facts);

    const stream = await openRouterAnalyzer.chat({ imageDataUrl, facts, turns });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

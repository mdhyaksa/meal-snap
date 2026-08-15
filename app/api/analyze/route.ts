import { assertImageDataUrl, errorResponse, readJson } from "@/app/api/_validate";
import { openRouterAnalyzer } from "@/lib/adapters/openrouter";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const imageDataUrl = assertImageDataUrl(body.imageDataUrl);
    const result = await openRouterAnalyzer.analyze(imageDataUrl);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

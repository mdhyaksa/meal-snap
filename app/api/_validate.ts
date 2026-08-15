import { AnalyzerError } from "@/lib/ports/food-analyzer";

/** Gemini accepts these; anything else is rejected at the boundary rather than forwarded. */
const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** base64 inflates ~4/3; leave room for the JSON envelope. */
export const MAX_BODY_BYTES = Math.ceil(MAX_IMAGE_BYTES * 1.4);

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) throw new AnalyzerError("Request too large.", 413);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) throw new AnalyzerError("Request too large.", 413);

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new AnalyzerError("Malformed request body.", 400);
  }
}

export function assertImageDataUrl(value: unknown): string {
  if (typeof value !== "string" || !value) throw new AnalyzerError("No image provided.", 400);

  const match = IMAGE_DATA_URL.exec(value);
  if (!match) throw new AnalyzerError("That file isn't a JPG, PNG or WebP image we can read.", 415);

  const base64 = match[2];
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const bytes = (base64.length * 3) / 4 - padding;
  if (bytes > MAX_IMAGE_BYTES) throw new AnalyzerError("Image is larger than 5 MB.", 413);

  return value;
}

export function errorResponse(error: unknown): Response {
  const status = error instanceof AnalyzerError ? error.status : 500;
  const message =
    error instanceof AnalyzerError ? error.message : "Something went wrong analysing your meal. Try again.";
  if (!(error instanceof AnalyzerError)) console.error(error);
  return Response.json({ error: message }, { status });
}

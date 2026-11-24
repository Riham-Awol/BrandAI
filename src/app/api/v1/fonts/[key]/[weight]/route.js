import { FONT_BY_KEY } from "@/modules/brand/catalog/fonts.js";
import { readFontFile } from "@/server/brand/fonts.js";
import { fail } from "@/server/http/api-response.js";

/** Self-hosted, open-licensed brand fonts (no third-party font requests). */
export async function GET(_request, { params }) {
  const { key, weight } = await params;
  const font = FONT_BY_KEY[key];
  if (!font || !font.weights.includes(Number(weight))) return fail("NOT_FOUND", "Font not found.", 404);
  const data = await readFontFile(key, Number(weight));
  return new Response(data, {
    headers: { "Content-Type": "font/woff", "Cache-Control": "public, max-age=31536000, immutable", "Access-Control-Allow-Origin": "*" },
  });
}

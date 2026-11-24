import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseFont } from "opentype.js";
import { FONT_BY_KEY, nearestWeight } from "@/modules/brand/catalog/fonts.js";

const cache = new Map();

/** Absolute path of a bundled @fontsource WOFF file (latin subset). */
export function fontFilePath(key, weight) {
  const font = FONT_BY_KEY[key];
  if (!font) throw new Error(`Unknown font: ${key}`);
  const w = nearestWeight(key, weight);
  return path.join(process.cwd(), "node_modules", "@fontsource", font.pkg, "files", `${font.pkg}-latin-${w}-normal.woff`);
}

export function readFontFile(key, weight) {
  return readFile(fontFilePath(key, weight));
}

/** Parsed opentype.js font, cached per process. */
export function loadFont(key, weight) {
  const id = `${key}:${nearestWeight(key, weight)}`;
  if (!cache.has(id)) {
    cache.set(
      id,
      readFontFile(key, weight).then((buf) => parseFont(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))),
    );
  }
  return cache.get(id);
}

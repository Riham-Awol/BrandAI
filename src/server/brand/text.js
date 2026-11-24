import "server-only";

/**
 * Shared text-to-outline utilities for generated SVG (logos, designs).
 * Text is laid out glyph by glyph and emitted as path data, so the output
 * never contains text nodes or fonts.
 */
export const xml = (s) => String(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]);
export const num = (n) => Number(n.toFixed(2));

export function applyCase(text, letterCase) {
  if (letterCase === "upper") return text.toUpperCase();
  if (letterCase === "lower") return text.toLowerCase();
  if (letterCase === "title") return text.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return text;
}

export function hasAllGlyphs(font, text) {
  return [...text].every((ch) => /\s/.test(ch) || font.charToGlyph(ch).index !== 0);
}

/**
 * Lays out text glyph by glyph (kerning + tracking). Glyphs are serialized
 * one by one (opentype.js 2.0 corrupts some coordinates when serializing a
 * combined path) and their bounding boxes merged.
 */
export function textPath(font, text, size, tracking = 0) {
  const scale = size / font.unitsPerEm;
  const parts = [];
  const box = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
  let x = 0;
  let prev = null;
  const chars = [...text];
  chars.forEach((ch, i) => {
    const glyph = font.charToGlyph(ch);
    if (prev) x += (font.getKerningValue(prev, glyph) || 0) * scale;
    const path = glyph.getPath(x, 0, size);
    if (path.commands.length) parts.push(serializeCommands(path.commands, box));
    x += (glyph.advanceWidth || 0) * scale + (i < chars.length - 1 ? tracking * size : 0);
    prev = glyph;
  });
  if (!Number.isFinite(box.x1)) Object.assign(box, { x1: 0, y1: -size * 0.7, x2: Math.max(x, 1), y2: 0 });
  return { d: parts.join(""), box: { ...box, w: box.x2 - box.x1, h: box.y2 - box.y1 } };
}

/** Absolute-command SVG path serializer; also grows the bounding box (control points included). */
export function serializeCommands(commands, box) {
  const f = (n) => (Number.isFinite(n) ? Number(n.toFixed(2)) : 0);
  const grow = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    box.x1 = Math.min(box.x1, x);
    box.y1 = Math.min(box.y1, y);
    box.x2 = Math.max(box.x2, x);
    box.y2 = Math.max(box.y2, y);
  };
  let d = "";
  for (const c of commands) {
    if (c.type === "M" || c.type === "L") {
      d += `${c.type}${f(c.x)} ${f(c.y)}`;
      grow(c.x, c.y);
    } else if (c.type === "Q") {
      d += `Q${f(c.x1)} ${f(c.y1)} ${f(c.x)} ${f(c.y)}`;
      grow(c.x1, c.y1);
      grow(c.x, c.y);
    } else if (c.type === "C") {
      d += `C${f(c.x1)} ${f(c.y1)} ${f(c.x2)} ${f(c.y2)} ${f(c.x)} ${f(c.y)}`;
      grow(c.x1, c.y1);
      grow(c.x2, c.y2);
      grow(c.x, c.y);
    } else if (c.type === "Z") {
      d += "Z";
    }
  }
  return d;
}


/** Advance width of a single line (kerning + tracking), in px. */
export function measure(font, text, size, tracking = 0) {
  const scale = size / font.unitsPerEm;
  let width = 0;
  let prev = null;
  const chars = [...text];
  chars.forEach((ch, i) => {
    const glyph = font.charToGlyph(ch);
    if (prev) width += (font.getKerningValue(prev, glyph) || 0) * scale;
    width += (glyph.advanceWidth || 0) * scale + (i < chars.length - 1 ? tracking * size : 0);
    prev = glyph;
  });
  return width;
}

/** Greedy word wrap; words longer than the line are split by characters. */
export function wrapText(font, text, size, maxWidth, tracking = 0) {
  const lines = [];
  for (const paragraph of String(text).split(/\n+/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(font, candidate, size, tracking) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (measure(font, word, size, tracking) <= maxWidth) {
        line = word;
        continue;
      }
      let chunk = "";
      for (const ch of word) {
        if (measure(font, chunk + ch, size, tracking) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = ch;
        } else chunk += ch;
      }
      line = chunk;
    }
    if (line) lines.push(line);
  }
  return lines;
}

/**
 * Shrinks the font size until the text fits `maxLines` (and `maxHeight` if given);
 * at `minSize` the last line is truncated with an ellipsis.
 */
export function fitText(font, text, { maxWidth, maxLines, maxHeight, size, minSize = 8, lineHeight = 1.15, tracking = 0 }) {
  let current = size;
  const words = String(text).split(/\s+/).filter(Boolean);
  for (;;) {
    const lines = wrapText(font, text, current, maxWidth, tracking);
    const height = lines.length * current * lineHeight;
    // A size that would break a word across lines doesn't count as fitting.
    const wordsFit = words.every((w) => measure(font, w, current, tracking) <= maxWidth);
    const fits = wordsFit && lines.length <= maxLines && (!maxHeight || height <= maxHeight);
    if (fits || current <= minSize) {
      if (lines.length > maxLines) {
        const kept = lines.slice(0, maxLines);
        let last = kept[maxLines - 1];
        while (last && measure(font, `${last}…`, current, tracking) > maxWidth) last = last.slice(0, -1);
        kept[maxLines - 1] = `${last.trimEnd()}…`;
        return { lines: kept, size: current, truncated: true };
      }
      return { lines, size: current, truncated: false };
    }
    current = Math.max(minSize, current * 0.92);
  }
}

/** Renders fitted lines as outlined paths; returns the svg and the block height. */
export function textBlock(font, lines, size, { x, y, width, align = "left", lineHeight = 1.15, fill, tracking = 0 }) {
  const ascent = (font.ascender / font.unitsPerEm) * size;
  const parts = lines.map((line, i) => {
    const w = measure(font, line, size, tracking);
    const lx = align === "center" ? x + (width - w) / 2 : align === "right" ? x + width - w : x;
    const { d } = textPath(font, line, size, tracking);
    return `<path fill="${fill}" transform="translate(${num(lx)} ${num(y + ascent + i * size * lineHeight)})" d="${d}"/>`;
  });
  return { svg: parts.join(""), height: lines.length ? (lines.length - 1) * size * lineHeight + size * 1.05 : 0 };
}

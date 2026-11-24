"use client";

import { useEffect, useState } from "react";
import { FONT_BY_KEY, fontUrl, nearestWeight } from "../catalog/fonts.js";

const loaded = new Map();

/** CSS font-family for a bundled brand font (served from our own origin). */
export function brandFontFamily(key) {
  const family = FONT_BY_KEY[key]?.family ?? "Inter";
  return `"BA ${family}", ${FONT_BY_KEY[key]?.category === "serif" ? "Georgia, serif" : "system-ui, sans-serif"}`;
}

/** Loads the given fonts with the FontFace API; returns true when ready. */
export function useBrandFonts(fonts) {
  const id = fonts.map((f) => `${f.key}:${f.weight}`).join("|");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const loads = fonts
      .filter((f) => FONT_BY_KEY[f.key])
      .map(({ key, weight }) => {
        const w = nearestWeight(key, weight);
        const cacheKey = `${key}:${w}`;
        if (!loaded.has(cacheKey)) {
          const face = new FontFace(`BA ${FONT_BY_KEY[key].family}`, `url(${fontUrl(key, w)}) format("woff")`, { weight: String(w) });
          loaded.set(cacheKey, face.load().then((f) => document.fonts.add(f)).catch(() => null));
        }
        return loaded.get(cacheKey);
      });
    Promise.all(loads).then(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return ready;
}

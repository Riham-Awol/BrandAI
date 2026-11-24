"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * Shows server-rendered design SVG through <img> (scripts can never run in an
 * image context). The frame keeps the artboard's aspect ratio.
 */
export function DesignPreview({ svg, width, height, label, className, busy }) {
  const src = useMemo(() => (svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null), [svg]);
  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-lg border bg-muted shadow-sm", busy && "opacity-70 transition-opacity", className)}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- generated SVG data URI
        <img src={src} alt={label} className="absolute inset-0 size-full object-contain" />
      ) : (
        <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden="true" />
      )}
    </div>
  );
}

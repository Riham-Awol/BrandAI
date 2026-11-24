"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { downloadSvgAsPng } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const VARIANTS = [
  ["horizontal", "Horizontal"],
  ["stacked", "Stacked"],
  ["mark", "Icon / mark"],
  ["wordmark", "Wordmark"],
];
const THEMES = [
  ["color", "Colour", "bg-white"],
  ["mono", "Mono", "bg-white"],
  ["inverse", "Inverse", "bg-white"],
];

/**
 * Grid of logo variations. `srcFor(variant, theme)` returns the SVG URL.
 * With `downloadable`, each tile offers SVG and PNG downloads.
 */
export function LogoVariants({ srcFor, downloadable = false, filenameBase = "logo", onError }) {
  const [busy, setBusy] = useState(null);
  return (
    <div className="space-y-6">
      {VARIANTS.map(([variant, label]) => (
        <section key={variant} className="space-y-2">
          <h4 className="text-sm font-semibold">{label}</h4>
          <div className="grid gap-3 sm:grid-cols-3">
            {THEMES.map(([theme, themeLabel, bg]) => {
              const src = srcFor(variant, theme);
              const id = `${variant}-${theme}`;
              return (
                <figure key={theme} className="overflow-hidden rounded-xl border bg-card">
                  <div className={cn("relative h-28", bg)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`${label} logo, ${themeLabel.toLowerCase()}`} className="absolute inset-0 h-full w-full object-contain p-3" loading="lazy" />
                  </div>
                  <figcaption className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs">
                    <span className="text-muted-foreground">{themeLabel}</span>
                    {downloadable && (
                      <span className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" asChild>
                          <a href={`${src}&download=1`} download aria-label={`Download ${label} ${themeLabel} SVG`}><Download className="size-3" /> SVG</a>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          disabled={busy === id}
                          aria-label={`Download ${label} ${themeLabel} PNG`}
                          onClick={async () => {
                            setBusy(id);
                            try {
                              await downloadSvgAsPng(src, `${filenameBase}-${variant}-${theme}.png`);
                            } catch (e) {
                              onError?.(e.message);
                            } finally {
                              setBusy(null);
                            }
                          }}
                        >
                          <Download className="size-3" /> PNG
                        </Button>
                      </span>
                    )}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

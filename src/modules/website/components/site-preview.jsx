"use client";

import { useRef } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { SiteRenderer } from "./site/site-renderer";

const PREVIEW_BASE = "/__preview";

/**
 * Live preview of the draft, rendered with the same components as the public
 * site. Links are intercepted: page links switch the previewed page, anchors
 * scroll inside the frame, and nothing navigates away from the editor.
 * Clicking a section selects it for editing.
 */
export function SitePreview({ config, brand, year, pageSlug, device, onDevice, onNavigate, onSelectSection, mediaUrl, selectedSectionId }) {
  const frame = useRef(null);

  function onClickCapture(e) {
    const link = e.target.closest("a, button[type=submit]");
    if (link) {
      e.preventDefault();
      const href = link.getAttribute("href") ?? "";
      if (href.startsWith(PREVIEW_BASE)) {
        const [path, hash] = href.slice(PREVIEW_BASE.length).split("#");
        const slug = path.replace(/^\//, "").split("?")[0] || "home";
        onNavigate(slug);
        if (hash) requestAnimationFrame(() => frame.current?.querySelector(`#${CSS.escape(hash)}`)?.scrollIntoView({ behavior: "smooth" }));
        return;
      }
      if (href.startsWith("#")) {
        frame.current?.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    const section = e.target.closest("section[id]");
    if (section) onSelectSection(section.id);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Preview <span className="font-normal text-muted-foreground">· click a section to edit it</span></p>
        <div role="group" aria-label="Preview size" className="inline-flex rounded-lg border p-0.5">
          {[["desktop", Monitor, "Desktop"], ["mobile", Smartphone, "Phone"]].map(([key, Icon, label]) => (
            <button key={key} type="button" aria-pressed={device === key} onClick={() => onDevice(key)} className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs", device === key ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-muted/40 p-2">
        <div
          ref={frame}
          data-testid="site-preview"
          onClickCapture={onClickCapture}
          className={cn("mx-auto h-full overflow-y-auto rounded-lg bg-white shadow-sm [&_section]:cursor-pointer", device === "mobile" ? "max-w-[390px]" : "w-full")}
        >
          <style>{selectedSectionId ? `[data-testid=site-preview] section[id="${selectedSectionId}"]{outline:3px solid #b9a0d2;outline-offset:-3px}` : ""}</style>
          <SiteRenderer config={config} brand={brand} pageSlug={pageSlug} mode="preview" basePath={PREVIEW_BASE} media={mediaUrl} formAction="#" year={year} />
        </div>
      </div>
    </div>
  );
}

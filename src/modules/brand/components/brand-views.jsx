"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { humanize } from "@/lib/humanize";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FONT_BY_KEY } from "../catalog/fonts.js";
import { contrastRatio, contrastRating, readableOn } from "../color.js";
import { brandFontFamily, useBrandFonts } from "./use-brand-fonts";

/** Wraps "pick one" option lists: renders cards with a Select button that saves the choice. */
export function SelectableList({ items, output, endpoint, readOnly, onSaved, onError, renderItem, recommendation }) {
  const [selected, setSelected] = useState(output.state?.selected ?? 0);
  const [saving, setSaving] = useState(null);

  async function choose(index) {
    setSaving(index);
    try {
      await apiRequest(endpoint, { method: "PATCH", body: { outputId: output.id, state: { selected: index } } });
      setSelected(index);
      await onSaved?.();
    } catch (e) {
      onError?.(e.message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4">
      {recommendation && (
        <p className="rounded-xl border border-highlight/40 bg-accent/40 px-4 py-3 text-sm"><span className="font-semibold">Recommendation: </span>{recommendation}</p>
      )}
      <ul className="grid gap-4 md:grid-cols-2">
        {items.map((item, i) => {
          const isSelected = i === selected;
          return (
            <li key={i} className={cn("flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-soft transition-shadow", isSelected && "ring-2 ring-highlight")}>
              {renderItem(item, i, isSelected)}
              <div className="mt-auto flex items-center justify-between gap-2">
                {isSelected ? <Badge variant="success"><Check className="size-3" /> Selected</Badge> : <span />}
                {!readOnly && !isSelected && (
                  <Button size="sm" variant="outline" disabled={saving !== null} onClick={() => choose(i)} aria-label={`Select option ${i + 1}`}>
                    Select
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TaglineCard({ item }) {
  return (
    <div className="space-y-2">
      <p className="font-display text-xl leading-snug font-semibold">“{item.text}”</p>
      <Badge variant="outline" className="capitalize">{item.angle}</Badge>
      <p className="text-sm text-muted-foreground">{item.rationale}</p>
    </div>
  );
}

const ROLES = ["primary", "secondary", "accent", "dark", "light", "background"];

export function PaletteSwatches({ colors, size = "md" }) {
  return (
    <div className={cn("grid grid-cols-3 gap-2", size === "lg" && "sm:grid-cols-6")}>
      {ROLES.map((role) => (
        <div key={role} className="overflow-hidden rounded-lg border">
          <div className={cn("grid place-items-center text-xs font-semibold", size === "lg" ? "h-20" : "h-14")} style={{ background: colors[role], color: readableOn(colors[role]) }}>
            Aa
          </div>
          <div className="bg-card px-2 py-1.5">
            <p className="text-[11px] font-semibold capitalize">{role}</p>
            <p className="font-mono text-[11px] text-muted-foreground uppercase">{colors[role]}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Computed WCAG contrast checks for the key text/background pairs. */
export function ContrastChecks({ colors }) {
  const pairs = [
    ["Dark text on background", colors.dark, colors.background],
    ["Dark text on light", colors.dark, colors.light],
    ["Text on primary", readableOn(colors.primary), colors.primary],
    ["Primary on background", colors.primary, colors.background],
  ];
  return (
    <ul className="grid gap-1 text-xs">
      {pairs.map(([label, fg, bg]) => {
        const ratio = contrastRatio(fg, bg);
        const rating = contrastRating(ratio);
        return (
          <li key={label} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">{label}</span>
            <span className="flex items-center gap-1.5">
              <span className="font-mono">{ratio.toFixed(1)}:1</span>
              <Badge variant={rating === "Fail" ? "warning" : "success"}>{rating}</Badge>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function PaletteCard({ item }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="font-display text-lg font-semibold">{item.name}</p>
        <p className="text-sm text-muted-foreground">{item.mood} — {item.description}</p>
      </div>
      <PaletteSwatches colors={item.colors} />
      <ContrastChecks colors={item.colors} />
    </div>
  );
}

export function TypographyCard({ item, sampleName }) {
  const ready = useBrandFonts([{ key: item.headingFont, weight: item.headingWeight }, { key: item.bodyFont, weight: item.bodyWeight }]);
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">{item.name}</p>
        <Badge variant="outline">{item.personality}</Badge>
      </div>
      <div className={cn("space-y-2 rounded-lg border bg-background/60 p-4 transition-opacity", ready ? "opacity-100" : "opacity-40")}>
        <p style={{ fontFamily: brandFontFamily(item.headingFont), fontWeight: Number(item.headingWeight) }} className="text-3xl leading-tight">
          {sampleName}
        </p>
        <p style={{ fontFamily: brandFontFamily(item.bodyFont), fontWeight: Number(item.bodyWeight) }} className="text-sm leading-relaxed">
          The quick brown fox jumps over the lazy dog. Good design is as little design as possible.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Headings: {FONT_BY_KEY[item.headingFont]?.family} {item.headingWeight} · Body: {FONT_BY_KEY[item.bodyFont]?.family} {item.bodyWeight}
      </p>
      <p className="text-sm text-muted-foreground">{item.rationale}</p>
    </div>
  );
}

export function LogoConceptCard({ item, src }) {
  return (
    <div className="space-y-3">
      <div className="relative grid place-items-center h-36 rounded-lg border bg-white p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`${item.name} logo concept`} className="absolute inset-0 h-full w-full object-contain p-3" />
      </div>
      <div>
        <p className="font-semibold">{item.name}</p>
        <p className="text-xs text-muted-foreground capitalize">
          {humanize(item.markType)} · {FONT_BY_KEY[item.fontKey]?.family} {item.fontWeight}
          {item.markType === "icon" && item.icon ? ` · ${item.icon}` : ""}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">{item.rationale}</p>
    </div>
  );
}

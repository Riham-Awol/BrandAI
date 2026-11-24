"use client";

import { Printer } from "lucide-react";
import { humanize } from "@/lib/humanize";
import { Button } from "@/components/ui/button";
import { FONT_BY_KEY } from "../catalog/fonts.js";
import { hexToRgb } from "../color.js";
import { ContrastChecks, PaletteSwatches } from "./brand-views";
import { brandFontFamily, useBrandFonts } from "./use-brand-fonts";

function Section({ title, children }) {
  return (
    <section className="space-y-4 break-inside-avoid border-t pt-8">
      <h2 className="text-2xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function List({ items }) {
  if (!items?.length) return null;
  return <ul className="list-disc space-y-1 pl-5 text-[15px]">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>;
}

/** Printable brand guidelines built from the approved identity. */
export function GuidelinesDocument({ identity, logoSrc }) {
  const d = identity.data;
  const g = d.guidelines;
  const heading = d.typography.heading;
  const body = d.typography.body;
  useBrandFonts([{ key: heading.fontKey, weight: heading.weight }, { key: body.fontKey, weight: body.weight }]);
  const H = { fontFamily: brandFontFamily(heading.fontKey), fontWeight: Number(heading.weight) };
  const B = { fontFamily: brandFontFamily(body.fontKey), fontWeight: Number(body.weight) };

  return (
    <article className="mx-auto max-w-4xl space-y-8 rounded-2xl border bg-card p-6 shadow-soft sm:p-10 print:border-0 print:p-0 print:shadow-none">
      <div className="flex items-start justify-between gap-4 print:hidden">
        <p className="text-sm text-muted-foreground">Use your browser&apos;s print dialog to save as PDF.</p>
        <Button variant="outline" onClick={() => window.print()}><Printer /> Print / Save PDF</Button>
      </div>

      <header className="space-y-6">
        <div className="relative grid place-items-center h-48 rounded-xl border bg-white p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc("horizontal", "color")} alt={`${d.businessName} logo`} className="absolute inset-0 h-full w-full object-contain p-3" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Brand guidelines · version {identity.version}</p>
          <h1 className="text-4xl font-semibold" style={H}>{d.businessName}</h1>
          {d.tagline && <p className="mt-2 text-xl" style={B}>“{d.tagline}”</p>}
        </div>
      </header>

      {d.personality && (
        <Section title="Brand personality">
          <p className="text-[15px]">{d.personality.summary}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className="text-sm font-semibold">Archetype</p><p className="capitalize">{d.personality.archetype} · {d.personality.secondaryArchetype}</p></div>
            <div><p className="text-sm font-semibold">Brand promise</p><p>{d.personality.brandPromise}</p></div>
            <div><p className="text-sm font-semibold">We are</p><List items={d.personality.weAre} /></div>
            <div><p className="text-sm font-semibold">We are not</p><List items={d.personality.weAreNot} /></div>
          </div>
        </Section>
      )}

      <Section title="Logo">
        <div className="grid gap-3 sm:grid-cols-3">
          {[["stacked", "color", "bg-white"], ["mark", "color", "bg-white"], ["horizontal", "inverse", "bg-white"]].map(([v, t, bg]) => (
            <div key={`${v}-${t}`} className={`relative h-32 rounded-xl border ${bg}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc(v, t)} alt={`${humanize(v)} logo, ${t}`} className="absolute inset-0 h-full w-full object-contain p-3" />
            </div>
          ))}
        </div>
        {g && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className="text-sm font-semibold">Clear space</p><p className="text-[15px]">{g.logoUsage.clearSpace}</p></div>
            <div><p className="text-sm font-semibold">Minimum size</p><p className="text-[15px]">{g.logoUsage.minimumSize}</p></div>
            <div><p className="text-sm font-semibold">Do</p><List items={g.logoUsage.dos} /></div>
            <div><p className="text-sm font-semibold">Don&apos;t</p><List items={g.logoUsage.donts} /></div>
          </div>
        )}
      </Section>

      <Section title="Colour">
        <PaletteSwatches colors={d.palette.colors} size="lg" />
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b"><th className="py-2">Role</th><th>HEX</th><th>RGB</th></tr></thead>
          <tbody>
            {Object.entries(d.palette.colors).map(([role, hex]) => {
              const { r, g: gg, b } = hexToRgb(hex);
              return <tr key={role} className="border-b last:border-0"><td className="py-2 capitalize">{role}</td><td className="font-mono uppercase">{hex}</td><td className="font-mono">{r}, {gg}, {b}</td></tr>;
            })}
          </tbody>
        </table>
        <ContrastChecks colors={d.palette.colors} />
        <List items={g?.colorUsage ?? d.palette.usageNotes} />
      </Section>

      <Section title="Typography">
        <div className="space-y-3 rounded-xl border p-5">
          <p className="text-3xl" style={H}>{FONT_BY_KEY[heading.fontKey]?.family} — headings</p>
          <p className="text-[15px] leading-relaxed" style={B}>{FONT_BY_KEY[body.fontKey]?.family} — body text. The quick brown fox jumps over the lazy dog. 0123456789</p>
        </div>
        <List items={g?.typographyUsage} />
      </Section>

      {d.voice && (
        <Section title="Voice & tone">
          <p className="text-[15px]">{d.voice.summary}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {d.voice.toneAttributes.map((t) => (
              <div key={t.attribute} className="rounded-xl border p-4 text-sm">
                <p className="font-semibold">{t.attribute}</p>
                <p className="text-muted-foreground">{t.description}</p>
                <p className="mt-2"><span className="font-semibold">Do: </span>{t.do}</p>
                <p><span className="font-semibold">Don&apos;t: </span>{t.dont}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className="text-sm font-semibold">Words we use</p><List items={d.voice.vocabulary.preferred} /></div>
            <div><p className="text-sm font-semibold">Words we avoid</p><List items={d.voice.vocabulary.avoid} /></div>
          </div>
        </Section>
      )}

      {g && (
        <Section title="Imagery & applications">
          <p className="text-[15px]">{g.imageryStyle.description}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className="text-sm font-semibold">Do</p><List items={g.imageryStyle.dos} /></div>
            <div><p className="text-sm font-semibold">Don&apos;t</p><List items={g.imageryStyle.donts} /></div>
          </div>
          <List items={g.applicationTips} />
        </Section>
      )}
    </article>
  );
}

/**
 * Printable company profile (A4 pages). Plain component without hooks: used by
 * the print page and the studio preview. Colours come from the approved brand
 * with readable text guaranteed (site theme tokens).
 */
import { SITE_FONT_STACKS, siteFontCss, siteThemeVars } from "@/modules/website/site-theme.js";
import { addressLines, websiteLabel } from "../details.js";

function paragraphs(text) {
  return String(text ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

function Page({ children, className = "", style, cover = false }) {
  const tone = cover ? "bg-[var(--s-accent-bg)] text-[var(--s-accent-fg)]" : "bg-[var(--s-bg)] text-[var(--s-fg)]";
  return (
    <section className={`profile-page relative mx-auto flex aspect-[210/297] w-full max-w-[210mm] flex-col p-[12%] shadow-sm print:shadow-none ${tone} ${className}`} style={style}>
      {children}
    </section>
  );
}

const H = ({ children, className = "" }) => <h2 className={`text-[clamp(1.25rem,3.2cqw,2.2rem)] font-semibold leading-tight ${className}`} style={{ fontFamily: SITE_FONT_STACKS.heading }}>{children}</h2>;

export function ProfileBrochure({ content, brand, details }) {
  const vars = siteThemeVars(brand.colors);
  const { overview, offering, closing } = content;
  const contact = [...addressLines(details), details.phone, details.email, websiteLabel(details.website)].filter(Boolean);
  return (
    <div className="@container space-y-6 print:space-y-0" style={{ ...vars, fontFamily: SITE_FONT_STACKS.body }}>
      <style>{`${siteFontCss(brand)}@media print{.profile-page{break-after:page;max-width:none;box-shadow:none}}`}</style>

      <Page cover className="justify-between">
        <div className="flex items-center gap-3">
          {brand.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- server-rendered vector logo
            <img src={brand.logo} alt={brand.name} className="h-16 w-auto max-w-[60%] rounded-lg bg-[var(--s-bg)] object-contain p-3" />
          ) : (
            <p className="text-2xl font-semibold" style={{ fontFamily: SITE_FONT_STACKS.heading }}>{brand.name}</p>
          )}
        </div>
        <div className="space-y-5">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] opacity-80">Company profile</p>
          <h1 className="text-[clamp(2rem,7cqw,4rem)] font-semibold leading-[1.05]" style={{ fontFamily: SITE_FONT_STACKS.heading }}>{overview?.headline || brand.name}</h1>
          <p className="text-lg opacity-90">{brand.name}</p>
        </div>
        <p className="text-sm opacity-80">{details.legalName || brand.name}{details.website ? ` · ${websiteLabel(details.website)}` : ""}</p>
      </Page>

      {overview && (
        <Page>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--s-highlight)]">About us</p>
          <H className="mt-2">Who we are</H>
          <div className="mt-6 space-y-4 text-[clamp(0.8rem,1.9cqw,1.05rem)] leading-relaxed text-[var(--s-muted-fg)]">{paragraphs(overview.summary).map((p, i) => <p key={i}>{p}</p>)}</div>
          <div className="mt-8 grid gap-6 @lg:grid-cols-2">
            <div className="rounded-xl bg-[var(--s-soft)] p-5 text-[var(--s-soft-fg)]"><p className="text-xs font-semibold uppercase tracking-widest">Mission</p><p className="mt-2 text-[clamp(0.85rem,2cqw,1.1rem)] font-medium">{overview.mission}</p></div>
            <div className="rounded-xl bg-[var(--s-soft)] p-5 text-[var(--s-soft-fg)]"><p className="text-xs font-semibold uppercase tracking-widest">Vision</p><p className="mt-2 text-[clamp(0.85rem,2cqw,1.1rem)] font-medium">{overview.vision}</p></div>
          </div>
          {overview.values?.length > 0 && (
            <>
              <H className="mt-10">Our values</H>
              <ul className="mt-4 grid gap-4 @lg:grid-cols-2">{overview.values.map((v) => <li key={v.name} className="border-l-4 border-[var(--s-btn)] pl-4"><p className="font-semibold">{v.name}</p><p className="text-sm text-[var(--s-muted-fg)]">{v.description}</p></li>)}</ul>
            </>
          )}
        </Page>
      )}

      {offering && (
        <Page>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--s-highlight)]">What we offer</p>
          <H className="mt-2">{offering.intro || "Our products and services"}</H>
          <ul className="mt-6 grid gap-4 @lg:grid-cols-2">
            {offering.offerings.map((o) => (
              <li key={o.name} className="rounded-xl border border-[var(--s-border)] p-4">
                <p className="font-semibold" style={{ fontFamily: SITE_FONT_STACKS.heading }}>{o.name}</p>
                <p className="mt-1 text-sm text-[var(--s-muted-fg)]">{o.description}</p>
                {o.benefits?.length > 0 && <ul className="mt-2 space-y-0.5 text-sm">{o.benefits.map((b) => <li key={b}>✓ {b}</li>)}</ul>}
              </li>
            ))}
          </ul>
          {offering.whyChooseUs?.length > 0 && (
            <>
              <H className="mt-8">Why choose us</H>
              <ul className="mt-4 grid gap-3 @lg:grid-cols-2">{offering.whyChooseUs.map((w) => <li key={w.title}><p className="font-semibold">{w.title}</p><p className="text-sm text-[var(--s-muted-fg)]">{w.description}</p></li>)}</ul>
            </>
          )}
          {offering.process?.length > 0 && (
            <>
              <H className="mt-8">How we work</H>
              <ol className="mt-4 grid gap-3 @lg:grid-cols-3">{offering.process.map((p, i) => <li key={p.step} className="rounded-lg bg-[var(--s-soft)] p-3 text-[var(--s-soft-fg)]"><p className="text-xs font-bold">STEP {i + 1}</p><p className="font-semibold">{p.step}</p><p className="text-sm">{p.description}</p></li>)}</ol>
            </>
          )}
        </Page>
      )}

      {closing && (
        <Page className="justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--s-highlight)]">Our promise</p>
            <H className="mt-2">Who we serve</H>
            <p className="mt-4 text-[clamp(0.85rem,2cqw,1.1rem)] leading-relaxed text-[var(--s-muted-fg)]">{closing.audience}</p>
            <ul className="mt-8 space-y-3">{closing.commitments.map((c) => <li key={c} className="flex gap-3 text-[clamp(0.85rem,2cqw,1.1rem)]"><span aria-hidden="true" className="text-[var(--s-highlight)]">●</span>{c}</li>)}</ul>
          </div>
          <div className="rounded-2xl bg-[var(--s-inverse-bg)] p-8 text-[var(--s-inverse-fg)]">
            <p className="text-[clamp(1.1rem,3cqw,1.8rem)] font-semibold" style={{ fontFamily: SITE_FONT_STACKS.heading }}>{closing.callToAction}</p>
            {contact.length > 0 && <ul className="mt-4 space-y-1 text-sm text-[var(--s-inverse-muted)]">{contact.map((c) => <li key={c}>{c}</li>)}</ul>}
          </div>
        </Page>
      )}
    </div>
  );
}

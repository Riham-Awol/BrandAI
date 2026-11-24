/**
 * Controlled website components. A site is rendered ONLY from its validated
 * config through these components — no AI-generated code or HTML is ever
 * executed or injected. All text is rendered as React text (escaped); links
 * pass `isSafeLink` at save time and `resolveHref` here.
 *
 * These are plain components without hooks so the same code renders the public
 * site (server) and the live preview in the editor (client). Layout responds
 * to the container width (container queries), so the preview's phone/desktop
 * toggle matches real devices.
 */
import { resolveHref } from "../../config-utils.js";
import { SOCIAL_NETWORKS } from "../../catalog.js";
import { SITE_FONT_STACKS, siteFontCss, siteThemeVars } from "../../site-theme.js";
import { SITE_ICONS } from "./icons.js";

const THEME = {
  modern: { radius: "rounded-2xl", button: "rounded-full", card: "rounded-2xl bg-[var(--s-bg)] p-6 shadow-sm ring-1 ring-[var(--s-border)]", heading: "font-semibold tracking-tight", align: "text-left", eyebrow: "text-sm font-semibold" },
  classic: { radius: "rounded-none", button: "rounded-none", card: "border-t border-[var(--s-border)] pt-6", heading: "font-medium", align: "text-center", eyebrow: "text-xs uppercase tracking-[0.2em]" },
  bold: { radius: "rounded-xl", button: "rounded-lg", card: "rounded-xl bg-[var(--s-soft)] p-6", heading: "font-extrabold tracking-tight", align: "text-left", eyebrow: "text-sm font-bold uppercase tracking-wide" },
};

const BG = {
  default: "bg-[var(--s-bg)] text-[var(--s-fg)]",
  muted: "bg-[var(--s-soft)] text-[var(--s-soft-fg)]",
  accent: "bg-[var(--s-accent-bg)] text-[var(--s-accent-fg)] [--s-btn:var(--s-accent-btn)] [--s-btn-fg:var(--s-accent-btn-fg)] [--s-muted-fg:var(--s-accent-fg)] [--s-highlight:var(--s-accent-fg)] [--s-border:color-mix(in_srgb,var(--s-accent-fg)_25%,transparent)]",
  inverse: "bg-[var(--s-inverse-bg)] text-[var(--s-inverse-fg)] [--s-muted-fg:var(--s-inverse-muted)] [--s-highlight:var(--s-inverse-fg)] [--s-border:color-mix(in_srgb,var(--s-inverse-fg)_25%,transparent)]",
};

function paragraphs(text) {
  return String(text ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

function Icon({ name, className }) {
  const C = SITE_ICONS[name];
  return C ? <C aria-hidden="true" className={className} /> : null;
}

function Button({ label, link, ctx, variant = "primary" }) {
  const href = resolveHref(link, ctx.basePath);
  if (!label || !href) return null;
  const external = /^https?:/.test(href);
  const cls =
    variant === "primary"
      ? "bg-[var(--s-btn)] text-[var(--s-btn-fg)] hover:opacity-90"
      : "ring-1 ring-current/30 hover:bg-current/5";
  return (
    <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={`inline-flex min-h-11 items-center justify-center px-6 py-2.5 text-sm font-semibold transition ${ctx.t.button} ${cls}`}>
      {label}
    </a>
  );
}

function Heading({ section, ctx, level = 2, center, size = "text-3xl @3xl:text-4xl" }) {
  const H = `h${level}`;
  return (
    <div className={`max-w-3xl space-y-3 ${center ? "mx-auto text-center" : ""}`}>
      {section.eyebrow && <p className={`${ctx.t.eyebrow} text-[var(--s-highlight)]`}>{section.eyebrow}</p>}
      {section.heading && <H className={`${size} ${ctx.t.heading} leading-tight`} style={{ fontFamily: SITE_FONT_STACKS.heading }}>{section.heading}</H>}
      {section.subheading && <p className="text-lg text-[var(--s-muted-fg)]">{section.subheading}</p>}
    </div>
  );
}

function Body({ text, className = "" }) {
  const ps = paragraphs(text);
  if (!ps.length) return null;
  return <div className={`space-y-4 leading-relaxed text-[var(--s-muted-fg)] ${className}`}>{ps.map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</div>;
}

function Image({ fileId, ctx, alt = "", className }) {
  if (!fileId) return null;
  // eslint-disable-next-line @next/next/no-img-element -- media served from validated brand assets
  return <img src={ctx.media(fileId)} alt={alt} loading="lazy" className={`object-cover ${className}`} />;
}

function Wrap({ section, children, className = "" }) {
  return (
    <section id={section.id} className={`${BG[section.background] ?? BG.default} scroll-mt-20`}>
      <div className={`mx-auto max-w-6xl px-5 py-16 @3xl:px-8 @3xl:py-24 ${className}`}>{children}</div>
    </section>
  );
}

function Hero({ section, ctx }) {
  const bold = ctx.theme === "bold";
  const s = bold && section.background === "default" ? { ...section, background: "accent" } : section;
  const center = ctx.theme === "classic" && !section.imageFileId;
  return (
    <Wrap section={s} className="@3xl:py-28">
      <div className={`grid items-center gap-10 ${section.imageFileId ? "@3xl:grid-cols-2" : ""}`}>
        <div className={`space-y-8 ${center ? "text-center" : ""}`}>
          <Heading section={section} ctx={ctx} level={1} center={center} size={bold ? "text-4xl @3xl:text-6xl" : "text-4xl @3xl:text-5xl"} />
          <Body text={section.body} className={center ? "mx-auto max-w-2xl" : "max-w-2xl"} />
          <div className={`flex flex-wrap gap-3 ${center ? "justify-center" : ""}`}>
            <Button label={section.ctaLabel} link={section.ctaLink} ctx={ctx} />
            <Button label={section.secondaryLabel} link={section.secondaryLink} ctx={ctx} variant="secondary" />
          </div>
        </div>
        <Image fileId={section.imageFileId} ctx={ctx} alt="" className={`aspect-[4/3] w-full ${ctx.t.radius}`} />
      </div>
    </Wrap>
  );
}

function Cards({ section, ctx, kind }) {
  const items = section.items ?? [];
  const cols = kind === "faq" ? "" : items.length === 2 || items.length === 4 ? "@2xl:grid-cols-2" : "@2xl:grid-cols-2 @4xl:grid-cols-3";
  const center = ctx.t.align === "text-center";
  return (
    <Wrap section={section}>
      <div className="space-y-12">
        <Heading section={section} ctx={ctx} center={center} />
        <Body text={section.body} className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"} />
        {kind === "faq" ? (
          <div className="mx-auto max-w-3xl divide-y divide-[var(--s-border)] border-y border-[var(--s-border)]">
            {items.map((item, i) => (
              <details key={i} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                  {item.title}
                  <span aria-hidden="true" className="text-[var(--s-highlight)] transition group-open:rotate-45">+</span>
                </summary>
                <Body text={item.text} className="pt-3" />
              </details>
            ))}
          </div>
        ) : (
          <ul className={`grid gap-6 ${cols}`}>
            {items.map((item, i) => (
              <li key={i} className={`flex flex-col gap-3 ${ctx.t.card}`}>
                {item.imageFileId && <Image fileId={item.imageFileId} ctx={ctx} alt={item.title} className={`-mx-0 mb-2 aspect-[4/3] w-full ${ctx.t.radius}`} />}
                {item.icon && <Icon name={item.icon} className="size-7 text-[var(--s-highlight)]" />}
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold leading-snug" style={{ fontFamily: SITE_FONT_STACKS.heading }}>{item.title}</h3>
                  {item.meta && <span className="shrink-0 text-sm font-semibold text-[var(--s-highlight)]">{item.meta}</span>}
                </div>
                <Body text={item.text} className="text-[15px]" />
                {kind === "products" ? (
                  <div className="mt-auto pt-2">
                    <Button label="Order / enquire" link={ctx.orderLink(item.title)} ctx={ctx} variant="secondary" />
                  </div>
                ) : (
                  item.link && <div className="mt-auto pt-1"><Button label="Learn more" link={item.link} ctx={ctx} variant="secondary" /></div>
                )}
              </li>
            ))}
          </ul>
        )}
        {section.ctaLabel && <div className={center ? "text-center" : ""}><Button label={section.ctaLabel} link={section.ctaLink} ctx={ctx} /></div>}
      </div>
    </Wrap>
  );
}

function About({ section, ctx }) {
  return (
    <Wrap section={section}>
      <div className={`grid items-center gap-10 ${section.imageFileId ? "@3xl:grid-cols-2" : ""}`}>
        <Image fileId={section.imageFileId} ctx={ctx} alt="" className={`aspect-[4/3] w-full ${ctx.t.radius}`} />
        <div className="space-y-6">
          <Heading section={section} ctx={ctx} />
          <Body text={section.body} className="max-w-2xl text-lg" />
          {section.items?.length > 0 && (
            <ul className="space-y-2">{section.items.map((i, n) => <li key={n} className="flex gap-2"><span aria-hidden="true" className="text-[var(--s-highlight)]">✓</span><span><strong>{i.title}</strong>{i.text ? ` — ${i.text}` : ""}</span></li>)}</ul>
          )}
          <Button label={section.ctaLabel} link={section.ctaLink} ctx={ctx} />
        </div>
      </div>
    </Wrap>
  );
}

function Gallery({ section, ctx }) {
  const images = [section.imageFileId, ...(section.items ?? []).map((i) => i.imageFileId)].filter(Boolean);
  if (!images.length && ctx.mode === "public") return null;
  return (
    <Wrap section={section}>
      <div className="space-y-10">
        <Heading section={section} ctx={ctx} center={ctx.t.align === "text-center"} />
        {images.length ? (
          <ul className="grid grid-cols-2 gap-3 @3xl:grid-cols-3">{images.map((id, i) => <li key={i}><Image fileId={id} ctx={ctx} alt="" className={`aspect-square w-full ${ctx.t.radius}`} /></li>)}</ul>
        ) : (
          <EditorHint>Add photos from your brand assets to show a gallery. Empty galleries are hidden on the live site.</EditorHint>
        )}
      </div>
    </Wrap>
  );
}

function Testimonials({ section, ctx }) {
  const items = (section.items ?? []).filter((i) => i.text);
  if (!items.length && ctx.mode === "public") return null;
  return (
    <Wrap section={section}>
      <div className="space-y-10">
        <Heading section={section} ctx={ctx} center />
        {items.length ? (
          <ul className="grid gap-6 @3xl:grid-cols-2">
            {items.map((i, n) => (
              <li key={n} className={ctx.t.card}>
                <blockquote className="space-y-4">
                  <p className="text-lg leading-relaxed">“{i.text}”</p>
                  <footer className="text-sm text-[var(--s-muted-fg)]"><strong className="text-[var(--s-fg)]">{i.title}</strong>{i.meta ? ` · ${i.meta}` : ""}</footer>
                </blockquote>
              </li>
            ))}
          </ul>
        ) : (
          <EditorHint>Add real quotes from your customers. Brand AI never writes reviews for you; empty sections are hidden on the live site.</EditorHint>
        )}
      </div>
    </Wrap>
  );
}

function Cta({ section, ctx }) {
  return (
    <Wrap section={section} className="@3xl:py-20">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
        <Heading section={section} ctx={ctx} center />
        <Body text={section.body} />
        <div className="flex flex-wrap justify-center gap-3">
          <Button label={section.ctaLabel} link={section.ctaLink} ctx={ctx} />
          <Button label={section.secondaryLabel} link={section.secondaryLink} ctx={ctx} variant="secondary" />
        </div>
      </div>
    </Wrap>
  );
}

function TextSection({ section, ctx }) {
  return (
    <Wrap section={section}>
      <div className="mx-auto max-w-3xl space-y-6">
        <Heading section={section} ctx={ctx} />
        <Body text={section.body} className="text-lg" />
      </div>
    </Wrap>
  );
}

const field = "w-full rounded-lg border border-[var(--s-border)] bg-[var(--s-bg)] px-4 py-3 text-[var(--s-fg)] outline-none focus:ring-2 focus:ring-[var(--s-btn)]";

function Contact({ section, ctx }) {
  const c = ctx.config.contact ?? {};
  const details = [
    c.email && { label: "Email", value: c.email, href: `mailto:${c.email}` },
    c.phone && { label: "Phone", value: c.phone, href: `tel:${c.phone.replace(/[^+\d]/g, "")}` },
    c.address && { label: "Address", value: c.address },
    c.hours && { label: "Opening hours", value: c.hours },
  ].filter(Boolean);
  const item = ctx.orderItem;
  return (
    <Wrap section={section}>
      <div className="grid gap-12 @3xl:grid-cols-[1fr_1.2fr]">
        <div className="space-y-6">
          <Heading section={section} ctx={ctx} />
          <Body text={section.body} />
          {details.length > 0 && (
            <dl className="space-y-4">
              {details.map((d) => (
                <div key={d.label}>
                  <dt className="text-sm text-[var(--s-muted-fg)]">{d.label}</dt>
                  <dd className="whitespace-pre-line font-medium">{d.href ? <a className="underline underline-offset-4" href={d.href}>{d.value}</a> : d.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className={ctx.t.card}>
          {ctx.notice === "sent" ? (
            <div role="status" className="space-y-2 py-8 text-center">
              <p className="text-xl font-semibold">Thank you — your message was sent.</p>
              <p className="text-[var(--s-muted-fg)]">We&apos;ll get back to you soon.</p>
            </div>
          ) : (
            <form method="post" action={ctx.formAction} className="space-y-4">
              {ctx.notice === "error" && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">Please check your details and try again.</p>}
              <input type="hidden" name="page" value={ctx.pagePath} />
              <input type="hidden" name="kind" value={item ? "order" : "contact"} />
              {item && <input type="hidden" name="item" value={item} />}
              {item && <p className="rounded-lg bg-[var(--s-soft)] px-4 py-3 text-sm text-[var(--s-soft-fg)]">Order enquiry: <strong>{item}</strong></p>}
              {/* Honeypot: hidden from people, filled by bots. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden"><label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label></div>
              <div className="grid gap-4 @xl:grid-cols-2">
                <label className="block space-y-1.5 text-sm font-medium">Name<input required name="name" maxLength={120} autoComplete="name" className={field} /></label>
                <label className="block space-y-1.5 text-sm font-medium">Email<input required type="email" name="email" maxLength={254} autoComplete="email" className={field} /></label>
              </div>
              <label className="block space-y-1.5 text-sm font-medium">Phone (optional)<input name="phone" maxLength={40} autoComplete="tel" className={field} /></label>
              <label className="block space-y-1.5 text-sm font-medium">Message<textarea required name="message" rows={5} maxLength={5000} defaultValue={item ? `I'd like to order: ${item}\n` : ""} className={field} /></label>
              <button type="submit" disabled={ctx.mode === "preview"} className={`inline-flex min-h-11 w-full items-center justify-center bg-[var(--s-btn)] px-6 py-2.5 text-sm font-semibold text-[var(--s-btn-fg)] disabled:opacity-60 ${ctx.t.button}`}>
                {item ? "Send order enquiry" : "Send message"}
              </button>
              {ctx.mode === "preview" && <p className="text-center text-xs text-[var(--s-muted-fg)]">The form works on the published site.</p>}
            </form>
          )}
        </div>
      </div>
    </Wrap>
  );
}

function EditorHint({ children }) {
  return <p className="rounded-xl border border-dashed border-current/30 p-6 text-center text-sm opacity-80">{children}</p>;
}

const SECTIONS = {
  hero: Hero,
  features: (p) => <Cards {...p} kind="features" />,
  services: (p) => <Cards {...p} kind="services" />,
  products: (p) => <Cards {...p} kind="products" />,
  portfolio: (p) => <Cards {...p} kind="portfolio" />,
  faq: (p) => <Cards {...p} kind="faq" />,
  about: About,
  gallery: Gallery,
  testimonials: Testimonials,
  cta: Cta,
  contact: Contact,
  text: TextSection,
};

function Header({ ctx }) {
  const { config, brand } = ctx;
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--s-border)] bg-[var(--s-bg)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3 @3xl:px-8">
        <a href={resolveHref("/", ctx.basePath)} className="flex min-h-11 items-center gap-3" aria-label={`${brand.name} home`}>
          {brand.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- server-rendered logo (data URI)
            <img src={brand.logo} alt={brand.name} className="h-9 w-auto max-w-[220px] object-contain" />
          ) : (
            <span className="text-xl font-semibold" style={{ fontFamily: SITE_FONT_STACKS.heading }}>{brand.name}</span>
          )}
        </a>
        {config.pages.length > 1 && (
          <nav aria-label="Main" className="-mx-2 flex max-w-full gap-1 overflow-x-auto text-sm font-medium">
            {config.pages.map((p) => (
              <a key={p.slug} href={resolveHref(`/${p.slug}`, ctx.basePath)} aria-current={p.slug === ctx.page.slug ? "page" : undefined} className="whitespace-nowrap rounded-md px-3 py-2 hover:bg-[var(--s-soft)] aria-[current=page]:text-[var(--s-highlight)] aria-[current=page]:underline aria-[current=page]:underline-offset-8">
                {p.title}
              </a>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

function Footer({ ctx }) {
  const { config, brand } = ctx;
  const year = ctx.year;
  return (
    <footer className="bg-[var(--s-inverse-bg)] text-[var(--s-inverse-fg)]">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 @3xl:grid-cols-3 @3xl:px-8">
        <div className="space-y-2">
          <p className="text-lg font-semibold" style={{ fontFamily: SITE_FONT_STACKS.heading }}>{brand.name}</p>
          {(config.footerText || config.tagline) && <p className="text-sm text-[var(--s-inverse-muted)]">{config.footerText || config.tagline}</p>}
        </div>
        {config.pages.length > 1 && (
          <nav aria-label="Footer" className="flex flex-col gap-2 text-sm">
            {config.pages.map((p) => <a key={p.slug} className="hover:underline" href={resolveHref(`/${p.slug}`, ctx.basePath)}>{p.title}</a>)}
          </nav>
        )}
        <div className="space-y-2 text-sm">
          {config.contact?.email && <p><a className="hover:underline" href={`mailto:${config.contact.email}`}>{config.contact.email}</a></p>}
          {config.contact?.phone && <p>{config.contact.phone}</p>}
          {config.social?.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {config.social.map((s, i) => <li key={i}><a className="hover:underline" href={s.url} target="_blank" rel="noopener noreferrer">{SOCIAL_NETWORKS[s.network]}</a></li>)}
            </ul>
          )}
        </div>
      </div>
      <div className="border-t border-[var(--s-inverse-fg)]/15">
        <p className="mx-auto max-w-6xl px-5 py-4 text-xs text-[var(--s-inverse-muted)] @3xl:px-8">© {year} {brand.name}</p>
      </div>
    </footer>
  );
}

/**
 * @param {object} props
 * @param {object} props.config  validated site config
 * @param {object} props.brand   { name, colors, heading, body, logo (data URI | null) }
 * @param {string} props.pageSlug
 * @param {"public"|"preview"} props.mode
 * @param {string} props.basePath  "" on a custom domain, "/sites/slug" otherwise
 * @param {(fileId: string) => string} props.media
 * @param {string} props.formAction
 * @param {string} [props.notice]  "sent" | "error"
 * @param {string} [props.orderItem]  product name pre-selected in the contact form
 * @param {number} props.year  copyright year (passed in: rendering must not read the clock)
 */
export function SiteRenderer({ config, brand, pageSlug, mode, basePath, media, formAction, notice, orderItem, year }) {
  const page = config.pages.find((p) => p.slug === pageSlug) ?? config.pages[0];
  const contactPage = config.pages.find((p) => p.sections.some((s) => s.type === "contact"));
  const contactSection = contactPage?.sections.find((s) => s.type === "contact");
  const ctx = {
    config, brand, page, mode, basePath, media, formAction, notice, orderItem, year,
    theme: config.theme,
    t: THEME[config.theme] ?? THEME.modern,
    pagePath: page.slug === "home" ? "/" : `/${page.slug}`,
    // Product "Order" buttons open the contact form with the product pre-selected.
    orderLink: (name) => (contactSection ? `${contactPage.slug === "home" ? "/" : `/${contactPage.slug}`}?item=${encodeURIComponent(name)}#${contactSection.id}` : null),
  };
  return (
    <div className="@container min-h-full bg-[var(--s-bg)] text-[var(--s-fg)] antialiased" style={{ ...siteThemeVars(brand.colors), fontFamily: SITE_FONT_STACKS.body }} data-site-theme={config.theme}>
      <style>{siteFontCss(brand)}</style>
      {config.announcement && <p className="bg-[var(--s-accent-bg)] px-5 py-2 text-center text-sm font-medium text-[var(--s-accent-fg)]">{config.announcement}</p>}
      <Header ctx={ctx} />
      <main>
        {page.sections.map((section) => {
          const C = SECTIONS[section.type];
          return C ? <C key={section.id} section={section} ctx={ctx} /> : null;
        })}
      </main>
      <Footer ctx={ctx} />
    </div>
  );
}

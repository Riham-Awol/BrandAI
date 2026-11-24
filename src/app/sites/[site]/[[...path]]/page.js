import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getPublishedSite } from "@/modules/website/service.js";
import { SiteRenderer } from "@/modules/website/components/site/site-renderer";

/**
 * Public, published websites: /sites/:slug/:page, or a verified custom domain
 * (the proxy rewrites the host to /sites/:domain/:page). Only the published
 * snapshot is rendered, through the controlled site components.
 */
function pickPage(config, path) {
  if (path && path.length > 1) return null;
  const slug = path?.[0] ?? "home";
  return config.pages.find((p) => p.slug === slug) ?? null;
}

export async function generateMetadata({ params }) {
  const { site, path } = await params;
  await connection(); // published content is read at request time
  const data = await getPublishedSite(site);
  const page = data && pickPage(data.config, path);
  if (!page) return { title: { absolute: "Page not found" }, robots: { index: false } };
  const title = page.seoTitle || (page.slug === "home" ? `${data.brand.name}${data.config.tagline ? ` — ${data.config.tagline}` : ""}` : `${page.title} · ${data.brand.name}`);
  const description = page.seoDescription || data.config.tagline || undefined;
  return { title: { absolute: title }, description, openGraph: { title, description, siteName: data.brand.name, type: "website" }, icons: { icon: [] } };
}

export default function PublicSitePage({ params, searchParams }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-white" />}>
      <Site params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Site({ params, searchParams }) {
  const [{ site, path }, query] = await Promise.all([params, searchParams]);
  await connection();
  const data = await getPublishedSite(site);
  const page = data && pickPage(data.config, path);
  if (!page) notFound();
  const base = data.viaDomain ? "" : `/sites/${data.website.slug}`;
  const item = typeof query.item === "string" ? query.item.slice(0, 200) : undefined;
  return (
    <SiteRenderer
      config={data.config}
      brand={data.brand}
      pageSlug={page.slug}
      mode="public"
      basePath={base}
      media={(id) => `/api/v1/sites/${site}/media/${id}`}
      formAction={`/api/v1/sites/${site}/contact`}
      notice={query.sent === "1" ? "sent" : query.error === "1" ? "error" : undefined}
      orderItem={item}
      year={new Date(data.publishedAt).getFullYear()}
    />
  );
}

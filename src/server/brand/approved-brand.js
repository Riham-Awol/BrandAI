import "server-only";
import { prisma } from "../db/prisma.js";
import { DEFAULT_BRAND } from "../design/renderer.js";
import { renderLogoSvg } from "./logo-renderer.js";

/**
 * The brand other studios draw with: the latest APPROVED identity, else a
 * neutral default (`approved: false` so the UI can say so).
 */
export async function resolveBrand(businessId, business) {
  const identity = await prisma.brandIdentity.findFirst({ where: { businessId, status: "APPROVED" }, orderBy: { version: "desc" }, select: { data: true } });
  const data = identity?.data;
  if (!data?.palette) return { ...DEFAULT_BRAND, name: business.name, approved: false };
  return {
    name: data.businessName || business.name,
    colors: { ...DEFAULT_BRAND.colors, ...data.palette.colors },
    heading: data.typography?.heading ?? DEFAULT_BRAND.heading,
    body: data.typography?.body ?? DEFAULT_BRAND.body,
    logo: data.logo ?? null,
    approved: true,
  };
}

/** Brand for websites: same as above, with the logo pre-rendered to a data URI (vector, validated data only). */
export async function resolveSiteBrand(businessId, business) {
  const brand = await resolveBrand(businessId, business);
  let logo = null;
  if (brand.logo) {
    const { svg } = await renderLogoSvg(brand.logo, { name: brand.name, variant: "horizontal", theme: "color", height: 72 });
    logo = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  }
  return { name: brand.name, colors: brand.colors, heading: brand.heading, body: brand.body, logo, approved: brand.approved };
}

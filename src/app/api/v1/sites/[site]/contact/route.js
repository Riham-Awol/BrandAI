import { NextResponse } from "next/server";
import { route } from "@/server/http/route-handler.js";
import { isAppError } from "@/server/errors.js";
import { submitSiteForm } from "@/modules/website/service.js";
import { submissionSchema } from "@/modules/website/schemas.js";

/**
 * Public contact/order form of a published site. A plain HTML form post (works
 * without JavaScript); redirects back to the page with ?sent=1 or ?error=1.
 * Same-origin check (route), honeypot, per-IP rate limit, length limits.
 */
export const POST = route({ auth: false, rateLimit: "siteForm" }, async ({ request, params, requestInfo }) => {
  const form = await request.formData().catch(() => null);
  const raw = Object.fromEntries([...(form?.entries() ?? [])].filter(([, v]) => typeof v === "string"));
  const parsed = submissionSchema.safeParse(raw);
  const page = typeof raw.page === "string" && /^\/[a-z0-9-]{0,40}$/.test(raw.page) ? raw.page : "/";
  const onDomain = params.site.includes(".");
  const base = onDomain ? "" : `/sites/${params.site}`;
  const back = (q) => NextResponse.redirect(new URL(`${base}${page === "/" ? (base ? "" : "/") : page}?${q}#contact`, request.url), 303);
  if (!parsed.success) {
    // Honeypot hits look like success to the bot; nothing is stored.
    if (raw.website) return back("sent=1");
    return back("error=1");
  }
  try {
    await submitSiteForm(params.site, parsed.data, { ip: requestInfo.ip });
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") return new Response("Not found", { status: 404 });
    throw error;
  }
  return back("sent=1");
});

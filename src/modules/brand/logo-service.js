import "server-only";
import { Errors } from "@/server/errors.js";
import { renderLogoSvg } from "@/server/brand/logo-renderer.js";
import { LOGO_THEMES, LOGO_VARIANTS } from "./schemas.js";
import { brandEngine, normalizeConcept } from "./service.js";
import { getCurrentIdentity } from "./identity-service.js";

export function parseLogoQuery(searchParams) {
  const variant = searchParams.get("variant") ?? "horizontal";
  const theme = searchParams.get("theme") ?? "color";
  const height = Math.min(1200, Math.max(16, Number(searchParams.get("height")) || 160));
  if (!LOGO_VARIANTS.includes(variant) || !LOGO_THEMES.includes(theme)) throw Errors.validation({ variant: ["Unknown logo variant or theme."] });
  return { variant, theme, height };
}

/** Renders one concept of a specific logo_concepts version. */
export async function renderProjectConcept(user, workspaceId, projectId, outputId, index, options) {
  const version = await brandEngine.getSectionVersion(user, workspaceId, projectId, "logo_concepts", outputId);
  const concept = version.content.concepts[Number(index)];
  if (!concept) throw Errors.notFound();
  const { project } = await brandEngine.getActiveContent(user, workspaceId, projectId);
  return renderLogoSvg(concept, { name: project.business.name, ...options });
}

/** Renders an unsaved concept (live preview in the logo editor). */
export async function renderPreview(user, workspaceId, projectId, concept, options) {
  const { project } = await brandEngine.getActiveContent(user, workspaceId, projectId);
  return renderLogoSvg(normalizeConcept(concept), { name: project.business.name, ...options });
}

/** Renders the business's approved logo. */
export async function renderApprovedLogo(user, workspaceId, businessId, options) {
  const { business, identity } = await getCurrentIdentity(user, workspaceId, businessId);
  if (!identity?.data.logo) throw Errors.notFound("No approved logo yet.");
  return { business, ...(await renderLogoSvg(identity.data.logo, { name: identity.data.businessName ?? business.name, ...options })) };
}

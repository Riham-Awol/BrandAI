/**
 * Pure mapping helpers between the structured profile, the central business
 * context and Launch Studio outputs.
 */
const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ""));
const joinList = (items) => (Array.isArray(items) && items.length ? items.join("; ") : undefined);

/** Profile → context sections (only sections with content are included). */
export function buildContextFromProfile(p) {
  const data = {
    basics: clean({
      name: p.name,
      industry: p.industry,
      description: p.description,
      stage: p.stage,
      valueProposition: p.valueProposition,
      businessModel: p.businessModel,
      locations: p.locations?.length ? p.locations.map(clean) : undefined,
    }),
  };
  if (p.products?.length || p.services?.length) data.offering = clean({ products: p.products?.map(clean), services: p.services?.map(clean) });
  if (p.audiences?.length || p.problems?.length) data.audience = clean({ segments: p.audiences?.map(clean), customerProblems: p.problems?.map(clean) });
  if (p.goals?.length) data.goals = { goals: p.goals.map(clean) };
  if (p.competitors?.length) data.competitors = { competitors: p.competitors.map(clean) };
  return data;
}

/**
 * Pre-fills a profile from Launch Studio outputs. Existing profile values win
 * when the outputs do not provide something; lists from outputs replace empty lists only.
 */
export function profileFromLaunchContent({ input, content, business, current }) {
  const base = current ?? {};
  const pick = (list, fallback) => (base[list]?.length ? base[list] : fallback);
  const offer = content.business_model?.productsAndServices ?? [];
  const toOffering = (o) => clean({ name: o.name, description: o.description, priceRange: o.priceRange });

  return {
    name: business.name && business.name !== "Untitled business" ? business.name : content.names?.suggestions?.[0]?.name ?? business.name,
    industry: base.industry ?? content.industry?.primaryIndustry ?? undefined,
    description: base.description ?? content.idea_analysis?.summary ?? input.idea,
    stage: base.stage ?? input.stage,
    valueProposition: base.valueProposition ?? content.strategy?.valueProposition ?? content.problems?.coreValueProposition,
    businessModel: base.businessModel ?? (content.business_model ? `${content.business_model.recommended.name}: ${content.business_model.recommended.description}` : undefined),
    products: pick("products", offer.filter((o) => o.type === "product").map(toOffering)),
    services: pick("services", offer.filter((o) => o.type === "service").map(toOffering)),
    locations: pick("locations", [{ city: input.city, country: input.country, isPrimary: true, isOnline: false }].map((l) => ({ ...clean(l), isPrimary: true, isOnline: false }))),
    audiences: pick(
      "audiences",
      (content.audience?.segments ?? []).map((s) => clean({ name: s.name, description: s.description, demographics: s.demographics, needs: joinList(s.needs), isPrimary: s.priority === "primary" })),
    ),
    problems: pick("problems", (content.problems?.problems ?? []).map((p) => clean({ problem: p.problem, solution: p.howWeSolve, severity: p.severity }))),
    competitors: pick(
      "competitors",
      (content.competitors?.competitors ?? []).map((c) => clean({ name: c.name, website: c.website || undefined, description: c.description, strengths: joinList(c.strengths), weaknesses: joinList(c.weaknesses) })),
    ),
    goals: pick("goals", (content.strategy?.goals ?? []).map((g) => clean({ title: g.title, description: g.description, timeframe: g.timeframe, metric: g.metric }))),
  };
}

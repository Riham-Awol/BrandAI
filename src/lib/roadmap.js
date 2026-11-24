/**
 * The ten product phases. `available` flips to true only when a phase passes
 * its acceptance criteria (see docs/PHASE_STATUS.md).
 */
export const PRODUCT_PHASES = [
  { phase: 1, key: "launch", title: "Business Launch Studio", summary: "Turn an idea into a structured business profile and launch plan.", available: true, href: "/launch" },
  { phase: 2, key: "brand", title: "Brand Identity Studio", summary: "Logos, palettes, typography, voice and brand guidelines.", available: true, href: "/brand" },
  { phase: 3, key: "strategy", title: "Marketing Strategy Studio", summary: "Personas, channels, budgets and KPIs.", available: false },
  { phase: 4, key: "social", title: "Social Media Studio", summary: "Captions, scripts, carousels and content calendars.", available: false },
  { phase: 5, key: "design", title: "Creative Design Studio", summary: "Posters, flyers, ads and on-brand social designs.", available: false },
  { phase: 6, key: "website", title: "Website Builder", summary: "Generate, edit and publish business websites.", available: false },
  { phase: 7, key: "stationery", title: "Stationery & Merchandise", summary: "Business cards, invoices, packaging and merch.", available: false },
  { phase: 8, key: "automation", title: "Calendar & Automation", summary: "Scheduling, approvals and permission-based publishing.", available: false },
  { phase: 9, key: "analytics", title: "Analytics & Insights", summary: "Performance reports and AI recommendations.", available: false },
  { phase: 10, key: "admin", title: "Teams, Agencies & Billing", summary: "Clients, roles, plans and AI credits.", available: false },
];

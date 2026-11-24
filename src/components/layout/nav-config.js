import { LayoutDashboard, Rocket, Palette, Target, Megaphone, PenTool, Globe, Printer, CalendarClock, BarChart3 } from "lucide-react";
import { PRODUCT_PHASES } from "@/lib/roadmap";

const ICONS = { launch: Rocket, brand: Palette, strategy: Target, social: Megaphone, design: PenTool, website: Globe, stationery: Printer, automation: CalendarClock, analytics: BarChart3 };

export const PRIMARY_NAV = [{ href: "/dashboard", label: "Overview", icon: LayoutDashboard }];

export const STUDIO_NAV = PRODUCT_PHASES.filter((p) => ICONS[p.key]).map((p) => ({
  key: p.key,
  label: p.title,
  icon: ICONS[p.key],
  phase: p.phase,
  available: p.available,
  href: p.href,
}));

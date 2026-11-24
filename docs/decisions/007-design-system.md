# ADR 007 — Design system

**Decision.** shadcn/ui conventions (`components.json`, `src/components/ui/*`, Radix primitives via
`radix-ui`, `class-variance-authority`, `cn()`), Tailwind v4 CSS-variable tokens defined once in
`globals.css` with light/dark themes (`next-themes`), Fraunces (display) + Manrope (UI) via
`next/font`, Lucide icons. Palette from the brief: #F7F4FA, #E8DDF4, #B9A0D2, #302442, #17151C.
**Note.** The shadcn registry host (ui.shadcn.com) was blocked by the build environment's network
policy, so the initial components were authored by hand in the shadcn format. When the registry is
reachable, `npx shadcn add <component>` works with the existing `components.json` (JSX, not TSX).
**Rules.** Components use semantic tokens (`bg-card`, `text-muted-foreground`), never raw hex.
Every data view ships loading, empty and error states and works at 390px.

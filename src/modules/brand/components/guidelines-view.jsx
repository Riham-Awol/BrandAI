"use client";

import { GuidelinesDocument } from "./guidelines-document";

/** Client wrapper so the logo URL builder can be a function. */
export function GuidelinesView({ identity, logoBase }) {
  return <GuidelinesDocument identity={identity} logoSrc={(variant, theme) => `${logoBase}?variant=${variant}&theme=${theme}&height=200`} />;
}

import { randomBytes } from "node:crypto";

export function slugify(input) {
  const base = String(input)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "workspace";
}

/** Slug with a short random suffix: unique without a read-then-write race. */
export function uniqueSlug(input) {
  return `${slugify(input)}-${randomBytes(3).toString("hex")}`;
}

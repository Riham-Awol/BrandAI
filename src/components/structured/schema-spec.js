/**
 * Converts a Zod schema into a small, serialisable "field spec" tree used by
 * the generic structured viewer/editor. Supports object, array, enum, string,
 * number and boolean — the shapes used by AI output schemas.
 */
export function schemaToSpec(schema) {
  const def = schema.def ?? schema._def;
  const description = schema.description;
  switch (def.type) {
    case "object":
      return { kind: "object", description, fields: Object.entries(schema.shape).map(([key, s]) => ({ key, ...schemaToSpec(s) })) };
    case "array":
      return { kind: "array", description, item: schemaToSpec(schema.element) };
    case "enum":
      return { kind: "enum", description, options: schema.options };
    case "number":
      return { kind: "number", description };
    case "boolean":
      return { kind: "boolean", description };
    case "optional":
    case "nullable":
    case "default":
      return schemaToSpec(def.innerType);
    default:
      return { kind: "string", description };
  }
}

/** An empty value matching a spec (used when adding list items). */
export function emptyValue(spec) {
  switch (spec.kind) {
    case "object":
      return Object.fromEntries(spec.fields.map((f) => [f.key, emptyValue(f)]));
    case "array":
      return [];
    case "enum":
      return spec.options[0];
    case "number":
      return 0;
    case "boolean":
      return false;
    default:
      return "";
  }
}

/** Immutable set at a path like ["suggestions", 0, "name"]. */
export function setAtPath(value, path, next) {
  if (path.length === 0) return next;
  const [head, ...rest] = path;
  if (Array.isArray(value)) {
    const copy = [...value];
    copy[head] = setAtPath(value[head], rest, next);
    return copy;
  }
  return { ...value, [head]: setAtPath(value?.[head], rest, next) };
}

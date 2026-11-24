import { humanize } from "@/lib/humanize";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TITLE_KEYS = ["name", "title", "task", "problem", "milestone", "item", "risk"];
const TONE = {
  strong: "success", promising: "success", high: "warning", primary: "default",
  needs_work: "warning", risky: "warning", direct: "default",
};

/**
 * Generic, readable renderer for structured AI output driven by a field spec.
 * Strings become paragraphs, enums become badges, string lists become bullet
 * lists and object lists become cards.
 */
export function StructuredView({ spec, value, renderItemActions, className }) {
  if (!spec || value == null) return null;
  return (
    <div className={cn("space-y-7", className)}>
      {spec.fields.map((field) => (
        <Field key={field.key} field={field} value={value[field.key]} renderItemActions={renderItemActions} path={[field.key]} />
      ))}
    </div>
  );
}

function Field({ field, value, renderItemActions, path }) {
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) return null;
  return (
    <section className="space-y-2.5">
      <h3 className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{humanize(field.key)}</h3>
      <Value spec={field} value={value} renderItemActions={renderItemActions} path={path} />
    </section>
  );
}

function Value({ spec, value, renderItemActions, path }) {
  switch (spec.kind) {
    case "enum":
      return <Badge variant={TONE[value] ?? "secondary"} className="capitalize">{humanize(value)}</Badge>;
    case "number":
      return <p className="font-display text-2xl font-semibold">{value}</p>;
    case "array":
      if (spec.item.kind === "object") {
        return (
          <div className="grid gap-3 md:grid-cols-2">
            {value.map((item, i) => (
              <ObjectCard key={i} spec={spec.item} value={item} actions={renderItemActions?.([...path, i], item)} />
            ))}
          </div>
        );
      }
      return (
        <ul className="grid gap-1.5">
          {value.map((v, i) => (
            <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed">
              <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-highlight" />
              <span>{String(v)}</span>
            </li>
          ))}
        </ul>
      );
    case "object":
      return (
        <div className="space-y-5 rounded-xl border bg-background/60 p-4 sm:p-5">
          {spec.fields.map((f) => (
            <Field key={f.key} field={f} value={value[f.key]} renderItemActions={renderItemActions} path={[...path, f.key]} />
          ))}
        </div>
      );
    default:
      return <p className="whitespace-pre-line text-[15px] leading-relaxed">{String(value)}</p>;
  }
}

function ObjectCard({ spec, value, actions }) {
  const titleKey = TITLE_KEYS.find((k) => spec.fields.some((f) => f.key === k && f.kind === "string"));
  const enums = spec.fields.filter((f) => f.kind === "enum" && value[f.key]);
  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-soft">
      {(titleKey || enums.length > 0) && (
        <header className="flex flex-wrap items-start justify-between gap-2">
          {titleKey && <h4 className="font-display text-lg leading-snug font-semibold">{value[titleKey]}</h4>}
          <div className="flex flex-wrap gap-1.5">
            {enums.map((f) => (
              <Badge key={f.key} variant={TONE[value[f.key]] ?? "secondary"} className="capitalize">{humanize(value[f.key])}</Badge>
            ))}
          </div>
        </header>
      )}
      {spec.fields
        .filter((f) => f.key !== titleKey && f.kind !== "enum")
        .map((f) => {
          const v = value[f.key];
          if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return null;
          return (
            <div key={f.key} className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">{humanize(f.key)}</p>
              {f.kind === "array" && f.item.kind !== "object" ? (
                <ul className="list-disc space-y-0.5 pl-4 text-sm">{v.map((x, i) => <li key={i}>{String(x)}</li>)}</ul>
              ) : f.kind === "array" ? (
                <div className="space-y-2">{v.map((x, i) => <ObjectCard key={i} spec={f.item} value={x} />)}</div>
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-line">{String(v)}</p>
              )}
            </div>
          );
        })}
      {actions && <div className="mt-auto flex flex-wrap gap-2 pt-1">{actions}</div>}
    </article>
  );
}

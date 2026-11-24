"use client";

import { Plus, Trash2 } from "lucide-react";
import { humanize } from "@/lib/humanize";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { emptyValue, setAtPath } from "./schema-spec";

/**
 * Generic editor for structured content, driven by a field spec. Fully
 * controlled: `onChange(nextValue)`. `errors` is a { "a.0.b": [msg] } map
 * from the API; matching fields are highlighted.
 */
export function StructuredEditor({ spec, value, onChange, errors = {} }) {
  return (
    <div className="space-y-6">
      {spec.fields.map((f) => (
        <EditorField key={f.key} spec={f} label={humanize(f.key)} path={[f.key]} value={value?.[f.key]} root={value} onChange={onChange} errors={errors} />
      ))}
    </div>
  );
}

function EditorField({ spec, label, path, value, root, onChange, errors }) {
  const id = `f-${path.join("-")}`;
  const error = errors[path.join(".")]?.[0];
  const set = (next) => onChange(setAtPath(root, path, next));
  const a11y = { id, "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${id}-err` : undefined };

  let control;
  switch (spec.kind) {
    case "object":
      return (
        <fieldset className="space-y-4 rounded-xl border p-4">
          <legend className="px-1 text-sm font-semibold">{label}</legend>
          {spec.fields.map((f) => (
            <EditorField key={f.key} spec={f} label={humanize(f.key)} path={[...path, f.key]} value={value?.[f.key]} root={root} onChange={onChange} errors={errors} />
          ))}
        </fieldset>
      );
    case "array":
      return <ArrayEditor spec={spec} label={label} path={path} value={value ?? []} root={root} onChange={onChange} errors={errors} />;
    case "enum":
      control = (
        <NativeSelect {...a11y} value={value ?? ""} onChange={(e) => set(e.target.value)}>
          {spec.options.map((o) => <option key={o} value={o}>{humanize(o)}</option>)}
        </NativeSelect>
      );
      break;
    case "number":
      control = <Input {...a11y} type="number" inputMode="decimal" value={value ?? 0} onChange={(e) => set(e.target.value === "" ? 0 : Number(e.target.value))} />;
      break;
    default: {
      const text = value ?? "";
      control =
        text.length > 80 || spec.description?.length > 60 ? (
          <Textarea {...a11y} rows={Math.min(14, Math.max(3, Math.ceil(text.length / 90)))} value={text} onChange={(e) => set(e.target.value)} />
        ) : (
          <Input {...a11y} value={text} onChange={(e) => set(e.target.value)} />
        );
    }
  }
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {spec.description && <p className="text-xs text-muted-foreground">{spec.description}</p>}
      {control}
      {error && <p id={`${id}-err`} className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

function ArrayEditor({ spec, label, path, value, root, onChange, errors }) {
  const update = (next) => onChange(setAtPath(root, path, next));
  const isObject = spec.item.kind === "object";
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">{label}</legend>
      {value.length === 0 && <p className="text-sm text-muted-foreground">No items yet.</p>}
      <ol className="space-y-3">
        {value.map((item, i) => (
          <li key={i} className={cn("flex gap-2", isObject && "flex-col rounded-xl border bg-background/50 p-3")}>
            <div className="min-w-0 flex-1">
              {isObject ? (
                <div className="space-y-3">
                  {spec.item.fields.map((f) => (
                    <EditorField key={f.key} spec={f} label={humanize(f.key)} path={[...path, i, f.key]} value={item?.[f.key]} root={root} onChange={onChange} errors={errors} />
                  ))}
                </div>
              ) : (
                <EditorField spec={spec.item} label={`${label} ${i + 1}`} path={[...path, i]} value={item} root={root} onChange={onChange} errors={errors} />
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size={isObject ? "sm" : "icon"}
              className={cn("text-muted-foreground", isObject ? "self-end" : "mt-6")}
              aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
              onClick={() => update(value.filter((_, j) => j !== i))}
            >
              <Trash2 /> {isObject && "Remove"}
            </Button>
          </li>
        ))}
      </ol>
      <Button type="button" variant="outline" size="sm" onClick={() => update([...value, emptyValue(spec.item)])}>
        <Plus /> Add {isObject ? "item" : "entry"}
      </Button>
    </fieldset>
  );
}

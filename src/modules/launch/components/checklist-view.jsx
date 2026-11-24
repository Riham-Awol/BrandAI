"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { humanize } from "@/lib/humanize";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function ChecklistView({ output, endpoint, canEdit, onError }) {
  const [completed, setCompleted] = useState(() => new Set(output.state?.completed ?? []));
  const total = output.content.categories.reduce((n, c) => n + c.items.length, 0);

  async function toggle(id) {
    const previous = completed;
    const next = new Set(completed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCompleted(next);
    try {
      await apiRequest(endpoint, { method: "PATCH", body: { outputId: output.id, completed: [...next] } });
    } catch (error) {
      setCompleted(previous);
      onError?.(error.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 rounded-xl border bg-card p-4 shadow-soft">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold">Launch progress</span>
          <span className="text-muted-foreground">{completed.size} of {total} done</span>
        </div>
        <Progress value={(completed.size / Math.max(1, total)) * 100} label="Launch checklist progress" />
      </div>
      {output.content.categories.map((category, ci) => (
        <section key={ci} className="space-y-2">
          <h3 className="text-lg font-semibold">{category.name}</h3>
          <ul className="divide-y rounded-xl border bg-card">
            {category.items.map((item, ii) => {
              const id = `${ci}-${ii}`;
              const done = completed.has(id);
              return (
                <li key={id} className="flex gap-3 p-4">
                  <Checkbox id={`chk-${id}`} checked={done} disabled={!canEdit} onChange={() => toggle(id)} className="mt-1" />
                  <label htmlFor={`chk-${id}`} className="min-w-0 flex-1 cursor-pointer space-y-1">
                    <span className={cn("block font-medium", done && "text-muted-foreground line-through")}>{item.task}</span>
                    <span className="block text-sm text-muted-foreground">{item.description}</span>
                    <span className="flex flex-wrap gap-1.5 pt-1">
                      <Badge variant={item.priority === "high" ? "warning" : "outline"} className="capitalize">{humanize(item.priority)} priority</Badge>
                      <Badge variant="outline">{item.timeframe}</Badge>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

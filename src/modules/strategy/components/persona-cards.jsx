import { Badge } from "@/components/ui/badge";

function List({ label, items }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <ul className="list-disc space-y-0.5 pl-4 text-sm">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

export function PersonaCards({ personas }) {
  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {personas.map((p, i) => (
        <li key={i} className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-soft">
          <header className="flex items-start gap-3">
            <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary font-display text-lg font-semibold text-secondary-foreground">
              {p.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-lg font-semibold leading-tight">{p.name}</h3>
              <p className="text-sm text-muted-foreground">{p.occupation} · {p.ageRange} · {p.location}</p>
              <Badge variant="outline" className="mt-1.5">{p.segment}</Badge>
            </div>
          </header>
          <blockquote className="border-l-2 border-highlight pl-3 text-sm italic">“{p.quote}”</blockquote>
          <p className="text-sm">{p.bio}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <List label="Goals" items={p.goals} />
            <List label="Pain points" items={p.painPoints} />
            <List label="Motivations" items={p.motivations} />
            <List label="Objections" items={p.objections} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Where to reach them</p>
            <div className="flex flex-wrap gap-1.5">{p.preferredChannels.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}</div>
          </div>
          <p className="text-sm"><span className="font-semibold">Buying behaviour: </span>{p.buyingBehaviour}</p>
        </li>
      ))}
    </ul>
  );
}

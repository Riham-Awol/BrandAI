export function AuthHeading({ title, description }) {
  return (
    <div className="mb-8 space-y-2">
      <h1 className="text-[28px] font-semibold">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

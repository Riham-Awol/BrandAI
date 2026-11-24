import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FORMATS, PLATFORMS, checkPost, composeCaption } from "../platforms.js";

/** Platform-style preview plus computed checks (length, hashtags, duration). */
export function PostPreview({ post, content, businessName }) {
  const checks = checkPost(post.platform, post.format, content);
  const text = composeCaption(content);
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border bg-background shadow-soft">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-semibold">{businessName.slice(0, 1)}</span>
          <span className="text-sm font-semibold">{businessName}</span>
          <Badge variant="outline" className="ml-auto">{PLATFORMS[post.platform].label} · {FORMATS[post.format]}</Badge>
        </div>
        <div className="grid min-h-28 place-items-center bg-muted/50 px-4 py-6 text-center text-xs text-muted-foreground">{content.visualIdea || "Visual"}</div>
        {content.slides?.length > 0 && (
          <ol className="flex snap-x gap-2 overflow-x-auto border-t p-3">
            {content.slides.map((s, i) => (
              <li key={i} className="w-40 shrink-0 snap-start rounded-lg border bg-card p-2 text-xs">
                <p className="font-semibold">{i + 1}. {s.heading}</p>
                <p className="text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        )}
        <div className="space-y-2 p-3 text-sm">
          {content.hook && <p className="font-semibold">{content.hook}</p>}
          <p className="whitespace-pre-line">{text}</p>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg border p-2"><dt className="text-muted-foreground">Characters</dt><dd className="font-semibold tabular-nums">{checks.captionLength}/{checks.captionMax}</dd></div>
        <div className="rounded-lg border p-2"><dt className="text-muted-foreground">Hashtags</dt><dd className="font-semibold tabular-nums">{checks.hashtagCount}</dd></div>
        <div className="rounded-lg border p-2"><dt className="text-muted-foreground">Video</dt><dd className="font-semibold tabular-nums">{post.format === "SHORT_VIDEO" ? `${checks.durationSeconds}s` : "—"}</dd></div>
      </dl>
      {checks.warnings.length ? (
        <ul className="space-y-1 text-xs text-warning">
          {checks.warnings.map((w) => <li key={w} className="flex gap-1.5"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {w}</li>)}
        </ul>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-success"><CheckCircle2 className="size-3.5" /> Fits {PLATFORMS[post.platform].label}&apos;s limits.</p>
      )}
    </div>
  );
}

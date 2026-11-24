import Link from "next/link";
import { cn } from "@/lib/utils";

/** Brand AI wordmark with a geometric monogram. */
export function Logo({ href = "/", className, compact = false }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", className)}>
      <span aria-hidden="true" className="relative grid size-8 place-items-center rounded-[10px] bg-primary text-primary-foreground shadow-soft">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 18V6h6.5a3 3 0 0 1 0 6H6m6.5 0a3 3 0 0 1 0 6H6" />
          <circle cx="18.5" cy="5.5" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      </span>
      {!compact && (
        <span className="font-display text-[19px] font-semibold tracking-tight">
          Brand<span className="text-highlight"> AI</span>
        </span>
      )}
    </Link>
  );
}

import { BRAND } from "@/lib/brand";
import { cx } from "./ui";

/** Black rounded square with a white clock glyph. */
export function Mark({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={cx("h-7 w-7", className)} aria-hidden>
      <rect width="32" height="32" rx="8" className={inverted ? "fill-white" : "fill-ink"} />
      <circle cx="16" cy="16" r="8.5" fill="none" strokeWidth="2.6" className={inverted ? "stroke-ink" : "stroke-white"} />
      <path d="M16 11.5 V16 L19.5 18" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className={inverted ? "stroke-ink" : "stroke-white"} />
    </svg>
  );
}

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <Mark inverted={inverted} />
      <span className={cx("text-[15px] font-semibold tracking-tight", inverted ? "text-white" : "text-ink")}>{BRAND.name}</span>
    </span>
  );
}

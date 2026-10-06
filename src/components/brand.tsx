import { BRAND } from "@/lib/brand";
import { cx } from "./ui";

/** Clock-face mark: gold ring, hands at roughly ten past ten. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cx("h-8 w-8", className)} aria-hidden>
      <circle cx="16" cy="16" r="15" className="fill-gold-500" />
      <circle cx="16" cy="16" r="11.5" className="fill-forest-900" />
      <path d="M16 16 L16 8.5" className="stroke-gold-200" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 16 L21.5 13" className="stroke-white" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="16" cy="16" r="1.8" className="fill-gold-400" />
    </svg>
  );
}

export function Logo({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <Mark />
      <span className={cx("font-display text-xl font-semibold tracking-tight", tone === "light" ? "text-white" : "text-ink")}>
        {BRAND.name}
      </span>
    </span>
  );
}

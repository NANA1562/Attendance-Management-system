import { CameraOff } from "lucide-react";
import { cx } from "./ui";

/** Tap photo thumbnail; hover to enlarge, click to open full size. */
export function PhotoThumb({ eventId, label, size = "sm" }: { eventId: string; label: string; size?: "sm" | "md" }) {
  const src = `/manage/photos/${eventId}`;
  return (
    <a href={src} target="_blank" rel="noreferrer" className="group/photo relative inline-block shrink-0" title={label}>
      {/* eslint-disable-next-line @next/next/no-img-element -- authenticated route, tiny image */}
      <img src={src} alt={label} loading="lazy" className={cx("rounded-full object-cover ring-2 ring-surface shadow-card", size === "sm" ? "h-7 w-7" : "h-10 w-10")} />
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop group-hover/photo:block">
        {/* eslint-disable-next-line @next/next/no-img-element -- enlarged preview */}
        <img src={src} alt="" className="h-36 w-48 rounded-lg object-cover" />
        <span className="block px-1.5 py-1 text-[11px] font-medium text-ink-2">{label}</span>
      </span>
    </a>
  );
}

export function NoPhoto() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200/70" title="Tapped without a photo (camera unavailable or blocked)">
      <CameraOff className="h-3 w-3" /> No photo
    </span>
  );
}

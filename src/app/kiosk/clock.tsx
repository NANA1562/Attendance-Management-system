"use client";

import { useSyncExternalStore } from "react";

// Re-render every 15s; render nothing on the server to avoid a hydration mismatch.
const subscribe = (cb: () => void) => {
  const id = setInterval(cb, 15000);
  return () => clearInterval(id);
};
const snapshot = () => Math.floor(Date.now() / 15000) * 15000;

export function Clock({ timeZone, size = "md" }: { timeZone: string; size?: "md" | "xl" }) {
  const ts = useSyncExternalStore(subscribe, snapshot, () => null);
  if (ts === null) return <div className={size === "xl" ? "h-28" : "h-10"} />;
  const now = new Date(ts);
  const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
  const date = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone });
  if (size === "md") {
    return (
      <span className="inline-flex items-center gap-2 rounded-[10px] border border-line-strong bg-surface px-3 py-1.5 text-[13px] shadow-card">
        <span className="font-semibold tabular-nums">{time}</span>
        <span className="text-muted">{date}</span>
      </span>
    );
  }
  return (
    <div>
      <div className="text-[88px] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[112px]">{time}</div>
      <div className="mt-3 text-lg text-muted">{date}</div>
    </div>
  );
}

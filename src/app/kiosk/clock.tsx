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
  if (ts === null) return <div className={size === "xl" ? "h-28" : "h-12"} />;
  const now = new Date(ts);
  return (
    <div className={size === "xl" ? "" : "text-right"}>
      <div className={size === "xl" ? "font-display text-7xl font-semibold tabular-nums tracking-tight sm:text-8xl" : "font-display text-3xl font-semibold tabular-nums"}>
        {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone })}
      </div>
      <div className={size === "xl" ? "mt-2 text-lg text-forest-200" : "text-sm text-forest-200"}>
        {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone })}
      </div>
    </div>
  );
}

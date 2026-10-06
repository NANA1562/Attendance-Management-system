"use client";

import { useSyncExternalStore } from "react";

// Re-render every 15s; render nothing on the server to avoid a hydration mismatch.
const subscribe = (cb: () => void) => {
  const id = setInterval(cb, 15000);
  return () => clearInterval(id);
};
const snapshot = () => Math.floor(Date.now() / 15000) * 15000;

export function Clock({ timeZone }: { timeZone: string }) {
  const ts = useSyncExternalStore(subscribe, snapshot, () => null);
  if (ts === null) return null;
  const now = new Date(ts);
  return (
    <div className="text-right">
      <div className="text-2xl font-semibold tabular-nums">
        {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone })}
      </div>
      <div className="text-sm text-stone-500">
        {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone })}
      </div>
    </div>
  );
}

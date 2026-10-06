"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./ui";

/**
 * Submit button for a plain <form action={serverAction}>. Disables itself while
 * the action runs so a slow connection doesn't invite double taps.
 */
export function FormButton({ children, pendingLabel, ...props }: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" {...props} disabled={pending || props.disabled} aria-busy={pending}>
      {pending ? (pendingLabel ?? "…") : children}
    </Button>
  );
}

/** Checkbox-style submit button for ticking a subtask. */
export function TickButton({ done, label }: { done: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left active:bg-stone-50 disabled:opacity-60">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 ${done ? "border-emerald-600 bg-emerald-600 text-white" : "border-stone-300"}`}
      >
        {pending ? "…" : done && "✓"}
      </span>
      <span className={done ? "text-stone-400 line-through" : ""}>{label}</span>
    </button>
  );
}

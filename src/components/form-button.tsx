"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Check, Loader2 } from "lucide-react";
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
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center gap-3.5 rounded-xl px-2 py-2.5 text-left transition hover:bg-canvas active:scale-[0.99] disabled:opacity-60"
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 transition ${
          done ? "border-forest-500 bg-forest-500 text-white" : "border-line-strong bg-surface"
        }`}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : done && <Check className="h-5 w-5 animate-pop" strokeWidth={3} />}
      </span>
      <span className={`text-[15px] font-medium ${done ? "text-muted line-through" : "text-ink"}`}>{label}</span>
    </button>
  );
}

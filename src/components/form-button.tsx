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
      className="flex w-full items-center gap-3.5 rounded-[10px] px-2 py-2 text-left transition hover:bg-subtle active:scale-[0.99] disabled:opacity-60"
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-[1.5px] transition ${
          done ? "border-ink bg-ink text-white" : "border-line-strong bg-surface"
        }`}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : done && <Check className="h-4 w-4 animate-pop" strokeWidth={3} />}
      </span>
      <span className={`text-[14px] ${done ? "text-muted line-through" : "text-ink"}`}>{label}</span>
    </button>
  );
}

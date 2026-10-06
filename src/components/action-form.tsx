"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { Button } from "./ui";

export type ActionState = { error?: string; ok?: string; secret?: { label: string; value: string } } | null;

const Pending = createContext(false);

/**
 * A form bound to a server action that returns ActionState. Shows the error
 * or success message, and a one-time secret (e.g. a new PIN). Unlike a plain
 * <form action>, fields are kept when the action returns an error.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
}: {
  action: (prev: ActionState, data: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && (state?.ok || state?.secret) && !state.error) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      <Pending.Provider value={pending}>{children}</Pending.Provider>
      {state?.error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.ok}</p>}
      {state?.secret && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
          <div className="text-amber-900">{state.secret.label} — shown once, write it down:</div>
          <div className="mt-1 font-mono text-2xl font-bold tracking-widest">{state.secret.value}</div>
        </div>
      )}
    </form>
  );
}

/** Submit button that disables itself while its ActionForm is submitting. */
export function SubmitButton({ children, pendingLabel, ...props }: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const pending = useContext(Pending);
  return (
    <Button type="submit" {...props} disabled={pending || props.disabled}>
      {pending ? (pendingLabel ?? "Saving…") : children}
    </Button>
  );
}

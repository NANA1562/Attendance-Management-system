"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { CircleAlert, CircleCheck, KeyRound } from "lucide-react";
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
      {state?.error && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-absent ring-1 ring-inset ring-red-200">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="mt-4 flex animate-fade-up items-start gap-2 rounded-xl bg-forest-50 px-3.5 py-2.5 text-sm font-medium text-forest-700 ring-1 ring-inset ring-forest-200">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" /> {state.ok}
        </p>
      )}
      {state?.secret && (
        <div className="mt-4 animate-fade-up rounded-xl bg-gold-50 p-4 ring-1 ring-inset ring-gold-200">
          <div className="flex items-center gap-2 text-sm font-semibold text-gold-700">
            <KeyRound className="h-4 w-4" /> {state.secret.label}
          </div>
          <div className="mt-2 font-mono text-4xl font-bold tracking-[0.3em] text-ink">{state.secret.value}</div>
          <div className="mt-2 text-xs text-gold-700">Shown once only. Write it down and give it to them in person.</div>
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

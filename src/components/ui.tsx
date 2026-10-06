import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { LiveStatus } from "@/lib/attendance/engine";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/format";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const BUTTON = {
  primary: "bg-stone-900 text-white hover:bg-stone-700",
  secondary: "bg-white text-stone-900 border border-stone-300 hover:bg-stone-50",
  danger: "bg-white text-red-700 border border-red-300 hover:bg-red-50",
  green: "bg-emerald-600 text-white hover:bg-emerald-500",
  amber: "bg-amber-500 text-white hover:bg-amber-400",
  red: "bg-red-600 text-white hover:bg-red-500",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof BUTTON }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50",
        BUTTON[variant],
        className,
      )}
    />
  );
}

export function LinkButton({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof BUTTON }) {
  return (
    <Link
      {...props}
      className={cx("inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium", BUTTON[variant], className)}
    />
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={cx(
        "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900",
        className,
      )}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={cx("w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900", className)}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={cx("w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900", className)}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-xl border border-stone-200 bg-white p-5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-4">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatusBadge({ status }: { status: LiveStatus }) {
  return (
    <span className={cx("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_TONE[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Pill({ children, tone = "bg-stone-100 text-stone-700" }: { children: ReactNode; tone?: string }) {
  return <span className={cx("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", tone)}>{children}</span>;
}

export function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</div>
      <div className={cx("mt-1 text-2xl font-semibold tabular-nums", tone)}>{value}</div>
    </div>
  );
}

const TASK: Record<string, [string, string]> = {
  not_started: ["Not started", "bg-stone-100 text-stone-700"],
  in_progress: ["In progress", "bg-amber-100 text-amber-800"],
  completed: ["Completed", "bg-emerald-100 text-emerald-800"],
  skipped: ["Skipped", "bg-stone-100 text-stone-500"],
};

export function TaskBadge({ status }: { status: string }) {
  const [label, tone] = TASK[status] ?? [status, ""];
  return <Pill tone={tone}>{label}</Pill>;
}

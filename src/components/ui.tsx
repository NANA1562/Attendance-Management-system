import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronDown, CircleDashed, type LucideIcon } from "lucide-react";
import type { LiveStatus } from "@/lib/attendance/engine";
import { STATUS_LABEL } from "@/lib/format";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ---------- buttons ----------

const BUTTON = {
  primary: "bg-ink text-white hover:bg-ink-2 shadow-card",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-subtle shadow-card",
  ghost: "text-ink-2 hover:bg-sunken hover:text-ink",
  danger: "bg-surface text-absent border border-red-200 hover:bg-red-50",
  accent: "bg-accent-600 text-white hover:bg-accent-700 shadow-card",
  // Kiosk action colours
  green: "bg-ok text-white hover:brightness-110 shadow-pop",
  amber: "bg-break text-ink hover:brightness-105 shadow-pop",
  red: "bg-ink text-white hover:bg-ink-2 shadow-pop",
};
export type ButtonVariant = keyof typeof BUTTON;

const buttonBase =
  "inline-flex h-9 items-center justify-center gap-2 rounded-[10px] px-3.5 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-100 disabled:pointer-events-none disabled:opacity-50";

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button {...props} className={cx(buttonBase, BUTTON[variant], className)} />;
}

export function LinkButton({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link {...props} className={cx(buttonBase, BUTTON[variant], className)} />;
}

// ---------- form fields ----------

const field =
  "h-9 w-full rounded-[10px] border border-line-strong bg-surface px-3 text-[13px] text-ink shadow-card placeholder:text-faint outline-none transition focus:border-accent-400 focus:ring-4 focus:ring-accent-100";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cx(field, className)} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <span className={cx("relative block", className)}>
      <select {...props} className={cx(field, "appearance-none pr-8")} />
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
    </span>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={cx(field, "h-auto py-2", className)} />;
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block space-y-1.5", className)}>
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

// ---------- layout ----------

/** Card with the double-bezel edge: a soft outer rim around a white panel. */
export function Card({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  flush = false,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** No inner padding (for tables that run edge to edge). */
  flush?: boolean;
}) {
  return (
    <section className={cx("rounded-[18px] border border-line bg-subtle p-[3px]", className)}>
      <div className={cx("h-full rounded-[15px] border border-line bg-surface shadow-card", !flush && "p-5", bodyClassName)}>
        {(title || actions) && (
          <div className={cx("flex items-start justify-between gap-4", flush ? "px-5 pb-4 pt-5" : "mb-5")}>
            <div>
              {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
              {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
            </div>
            {actions}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

/** Page title row: icon tile + title, optional description and actions. */
export function PageHeader({ icon: Icon, title, description, actions }: { icon?: LucideIcon; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-line-strong bg-surface shadow-card">
            <Icon className="h-[18px] w-[18px] text-ink-2" strokeWidth={1.75} />
          </span>
        )}
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-ink">{title}</h1>
          {description && <p className="text-[13px] text-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Rounded filter-style chip (link or static). */
export function Chip({ icon: Icon, children, href, active, className, title }: { icon?: LucideIcon; children?: ReactNode; href?: string; active?: boolean; className?: string; title?: string }) {
  const cls = cx(
    "inline-flex h-9 items-center gap-2 rounded-[10px] border px-3 text-[13px] font-medium shadow-card transition",
    active ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink-2 hover:bg-subtle hover:text-ink",
    className,
  );
  const body = (
    <>
      {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />}
      {children}
    </>
  );
  return href ? <Link href={href} className={cls} title={title}>{body}</Link> : <span className={cls} title={title}>{body}</span>;
}

export function Empty({ icon: Icon = CircleDashed, title, children }: { icon?: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="dot-grid flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-line-strong bg-surface shadow-card">
        <Icon className="h-5 w-5 text-muted" strokeWidth={1.75} />
      </span>
      <div className="mt-3 text-[13px] font-semibold text-ink">{title}</div>
      {children && <div className="mt-1 text-[13px] text-muted">{children}</div>}
    </div>
  );
}

/** Small uppercase mono label, as on workflow cards. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted", className)}>{children}</div>;
}

// ---------- status ----------

export const STATUS_STYLE: Record<LiveStatus, { pill: string; dot: string }> = {
  on_time: { pill: "bg-green-50 text-green-700 ring-green-200/70", dot: "bg-ok" },
  grace: { pill: "bg-teal-50 text-teal-700 ring-teal-200/70", dot: "bg-grace" },
  late: { pill: "bg-amber-50 text-amber-700 ring-amber-200/70", dot: "bg-late" },
  attendance_risk: { pill: "bg-orange-50 text-orange-700 ring-orange-200/70", dot: "bg-risk" },
  absent: { pill: "bg-red-50 text-red-700 ring-red-200/70", dot: "bg-absent" },
  off_day: { pill: "bg-sunken text-muted ring-line-strong", dot: "bg-faint" },
  worked_off_day: { pill: "bg-accent-50 text-accent-700 ring-accent-200/70", dot: "bg-accent-500" },
  on_leave: { pill: "bg-sky-50 text-sky-700 ring-sky-200/70", dot: "bg-leave" },
  not_in_yet: { pill: "bg-surface text-ink-2 ring-line-strong", dot: "bg-faint" },
};

export function StatusBadge({ status, size = "sm" }: { status: LiveStatus; size?: "sm" | "lg" }) {
  const { pill, dot } = STATUS_STYLE[status];
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset", size === "lg" ? "px-3 py-1 text-[13px]" : "px-2 py-0.5 text-xs", pill)}>
      <span className={cx("h-1.5 w-1.5 rounded-full", dot)} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Pill({ children, tone = "bg-sunken text-ink-2 ring-line-strong", className }: { children: ReactNode; tone?: string; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", tone, className)}>{children}</span>;
}

const TASK: Record<string, [string, string]> = {
  not_started: ["Not started", "bg-surface text-ink-2 ring-line-strong"],
  in_progress: ["In progress", "bg-amber-50 text-amber-700 ring-amber-200/70"],
  completed: ["Done", "bg-green-50 text-green-700 ring-green-200/70"],
  skipped: ["Skipped", "bg-sunken text-muted ring-line-strong"],
};

export function TaskBadge({ status }: { status: string }) {
  const [label, tone] = TASK[status] ?? [status, ""];
  return <Pill tone={tone}>{label}</Pill>;
}

// ---------- people ----------

// Identity tints for avatars (not status), picked by name so a person keeps theirs.
const AVATAR = [
  "bg-[#fde7d9] text-[#9a3f12]",
  "bg-[#e0ecff] text-[#2f4f8f]",
  "bg-[#ede4ff] text-[#5b3a9a]",
  "bg-[#dff5e8] text-[#25643e]",
  "bg-[#fff1c7] text-[#7a5a05]",
  "bg-[#fde2ec] text-[#93254f]",
];

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase();
}

export function Avatar({ name, size = "md", className }: { name: string; size?: "xs" | "sm" | "md" | "lg" | "xl"; className?: string }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const sizes = { xs: "h-5 w-5 text-[9px]", sm: "h-6 w-6 text-[10px]", md: "h-8 w-8 text-[11px]", lg: "h-11 w-11 text-sm", xl: "h-16 w-16 text-lg" };
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", AVATAR[h % AVATAR.length], sizes[size], className)}>
      {initials(name)}
    </span>
  );
}

/** Avatar + name, underlined like a link. */
export function Person({ name, href, size = "sm" }: { name: string; href?: string; size?: "xs" | "sm" | "md" }) {
  const body = (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <Avatar name={name} size={size} />
      <span className="font-medium text-ink underline decoration-line-strong underline-offset-4 group-hover:decoration-ink">{name}</span>
    </span>
  );
  return href ? <Link href={href} className="group">{body}</Link> : body;
}

// ---------- numbers ----------

/** Change versus a previous value, e.g. ↗ +2 or ↘ −1. `goodWhenUp` flips the colour logic. */
export function Delta({ value, suffix = "", goodWhenUp = true }: { value: number | null; suffix?: string; goodWhenUp?: boolean }) {
  if (value === null || !Number.isFinite(value)) return null;
  if (value === 0) return <span className="text-xs font-medium text-muted">same as yesterday</span>;
  const up = value > 0;
  const good = up === goodWhenUp;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cx("inline-flex items-center gap-0.5 text-[13px] font-medium", good ? "text-ok" : "text-absent")}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      {up ? "+" : "−"}
      {Math.abs(value)}
      {suffix}
    </span>
  );
}

export function Stat({
  label,
  value,
  icon: Icon,
  ring,
  delta,
  sub,
}: {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  ring?: { value: number; max: number; bar?: string };
  delta?: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <section className="rounded-[18px] border border-line bg-subtle p-[3px]">
      <div className="h-full rounded-[15px] border border-line bg-surface p-4 shadow-card">
        <div className="flex items-center gap-2 text-[13px] text-muted">
          {Icon && <Icon className="h-4 w-4" strokeWidth={1.75} />}
          {label}
        </div>
        <div className="mt-2.5 flex items-center gap-2.5">
          {ring && <Ring value={ring.value} max={ring.max} size={22} stroke={3} bar={ring.bar ?? "stroke-accent-500"} track="stroke-sunken" />}
          <span className="text-[26px] font-semibold leading-none tracking-tight tabular-nums text-ink">{value}</span>
          {delta}
        </div>
        {sub && <div className="mt-2 text-xs text-muted">{sub}</div>}
      </div>
    </section>
  );
}

/** Single-value progress ring (a headline, so no legend). */
export function Ring({
  value,
  max,
  size = 120,
  stroke = 12,
  track = "stroke-sunken",
  bar = "stroke-accent-500",
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  track?: string;
  bar?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={track} />
        {pct > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} className={cx(bar, "transition-[stroke-dasharray] duration-700")} />
        )}
      </svg>
      {children && <span className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</span>}
    </span>
  );
}

export function Progress({ value, max, className, bar = "bg-ok" }: { value: number; max: number; className?: string; bar?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className={cx("h-1.5 w-full overflow-hidden rounded-full bg-sunken", className)} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className={cx("h-full rounded-full transition-[width] duration-500", bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---------- tables ----------

export function Table({ children, minWidth = 720 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cx("whitespace-nowrap border-y border-line bg-subtle px-3 py-2.5 text-left font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted first:pl-5 last:pr-5", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx("border-b border-line px-3 py-3 align-middle first:pl-5 last:pr-5", className)}>{children}</td>;
}

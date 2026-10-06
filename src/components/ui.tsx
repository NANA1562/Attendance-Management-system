import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import {
  AlarmClock,
  CalendarOff,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Clock3,
  Hourglass,
  Palmtree,
  Sun,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { LiveStatus } from "@/lib/attendance/engine";
import { STATUS_LABEL } from "@/lib/format";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ---------- buttons ----------

const BUTTON = {
  primary: "bg-forest-800 text-white shadow-sm hover:bg-forest-700 focus-visible:ring-forest-500",
  gold: "bg-gold-500 text-forest-950 shadow-sm hover:bg-gold-400 focus-visible:ring-gold-500",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-sunken focus-visible:ring-forest-500",
  ghost: "text-ink-2 hover:bg-sunken hover:text-ink focus-visible:ring-forest-500",
  danger: "bg-surface text-absent border border-red-200 hover:bg-red-50 focus-visible:ring-absent",
  // Kiosk action colours
  green: "bg-forest-500 text-white shadow-lift hover:bg-forest-600 focus-visible:ring-forest-500",
  amber: "bg-gold-500 text-forest-950 shadow-lift hover:bg-gold-400 focus-visible:ring-gold-500",
  red: "bg-[#a8321f] text-white shadow-lift hover:bg-[#8f2a1a] focus-visible:ring-absent",
};
export type ButtonVariant = keyof typeof BUTTON;

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button {...props} className={cx(buttonBase, BUTTON[variant], className)} />;
}

export function LinkButton({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link {...props} className={cx(buttonBase, BUTTON[variant], className)} />;
}

// ---------- form fields ----------

const field =
  "w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted outline-none transition focus:border-forest-500 focus:ring-4 focus:ring-forest-100";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cx(field, className)} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <span className={cx("relative block", className)}>
      <select {...props} className={cx(field, "appearance-none pr-9")} />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
    </span>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={cx(field, className)} />;
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block space-y-1.5", className)}>
      <span className="text-[13px] font-semibold text-ink-2">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

// ---------- layout ----------

export function Card({
  title,
  description,
  actions,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cx("rounded-2xl border border-line bg-surface shadow-card", padded && "p-5 sm:p-6", className)}>
      {(title || actions) && (
        <div className={cx("mb-5 flex items-start justify-between gap-4", !padded && "px-5 pt-5 sm:px-6 sm:pt-6")}>
          <div>
            {title && <h2 className="text-[15px] font-bold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-gold-600">{eyebrow}</div>}
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-[34px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ icon: Icon = CircleDashed, title, children }: { icon?: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-canvas/50 px-6 py-10 text-center">
      <Icon className="h-7 w-7 text-muted" strokeWidth={1.6} />
      <div className="mt-3 text-sm font-semibold text-ink">{title}</div>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

// ---------- status ----------

export const STATUS_STYLE: Record<LiveStatus, { icon: LucideIcon; chip: string; dot: string }> = {
  on_time: { icon: CheckCircle2, chip: "bg-forest-50 text-forest-700 ring-forest-200", dot: "bg-ok" },
  grace: { icon: Clock3, chip: "bg-teal-50 text-grace ring-teal-200", dot: "bg-grace" },
  late: { icon: AlarmClock, chip: "bg-amber-50 text-late ring-amber-200", dot: "bg-late" },
  attendance_risk: { icon: TriangleAlert, chip: "bg-orange-50 text-risk ring-orange-200", dot: "bg-risk" },
  absent: { icon: XCircle, chip: "bg-red-50 text-absent ring-red-200", dot: "bg-absent" },
  off_day: { icon: Sun, chip: "bg-sunken text-muted ring-line-strong", dot: "bg-line-strong" },
  worked_off_day: { icon: CalendarOff, chip: "bg-sky-50 text-sky-800 ring-sky-200", dot: "bg-sky-600" },
  on_leave: { icon: Palmtree, chip: "bg-violet-50 text-leave ring-violet-200", dot: "bg-leave" },
  not_in_yet: { icon: Hourglass, chip: "bg-surface text-ink-2 ring-line-strong", dot: "bg-muted" },
};

export function StatusBadge({ status, size = "sm" }: { status: LiveStatus; size?: "sm" | "lg" }) {
  const { icon: Icon, chip } = STATUS_STYLE[status];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset",
        size === "lg" ? "px-3.5 py-1.5 text-sm" : "px-2.5 py-1 text-xs",
        chip,
      )}
    >
      <Icon className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} strokeWidth={2.2} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Pill({ children, tone = "bg-sunken text-ink-2", className }: { children: ReactNode; tone?: string; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", tone, className)}>{children}</span>;
}

const TASK: Record<string, [string, string]> = {
  not_started: ["Not started", "bg-sunken text-ink-2"],
  in_progress: ["In progress", "bg-gold-100 text-gold-700"],
  completed: ["Completed", "bg-forest-100 text-forest-700"],
  skipped: ["Skipped", "bg-sunken text-muted"],
};

export function TaskBadge({ status }: { status: string }) {
  const [label, tone] = TASK[status] ?? [status, ""];
  return <Pill tone={tone}>{label}</Pill>;
}

// ---------- people ----------

// Identity tints for avatars (not status). Picked by name so a person keeps their colour.
const AVATAR = [
  "bg-forest-100 text-forest-800",
  "bg-gold-100 text-gold-700",
  "bg-[#f3e1d7] text-[#8a3d1f]",
  "bg-[#dde7f0] text-[#2c4a66]",
  "bg-[#e9e0f1] text-[#553a76]",
  "bg-[#e2ece9] text-[#2c5a52]",
];

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase();
}

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const sizes = { sm: "h-7 w-7 text-[11px]", md: "h-9 w-9 text-xs", lg: "h-12 w-12 text-sm", xl: "h-16 w-16 text-lg" };
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-bold", AVATAR[h % AVATAR.length], sizes[size], className)}>
      {initials(name)}
    </span>
  );
}

// ---------- numbers ----------

export function Stat({
  label,
  value,
  icon: Icon,
  tone = "text-ink",
  iconTone = "bg-sunken text-ink-2",
  sub,
}: {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  tone?: string;
  iconTone?: string;
  sub?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[13px] font-semibold text-ink-2">{label}</div>
        {Icon && (
          <span className={cx("flex h-8 w-8 items-center justify-center rounded-lg", iconTone)}>
            <Icon className="h-4 w-4" strokeWidth={2.2} />
          </span>
        )}
      </div>
      <div className={cx("mt-2 font-display text-[34px] font-semibold leading-none tabular-nums", tone)}>{value}</div>
      {sub && <div className="mt-2 text-xs text-muted">{sub}</div>}
    </div>
  );
}

/** Single-value progress ring (a headline, so no legend). */
export function Ring({
  value,
  max,
  size = 120,
  stroke = 12,
  track = "stroke-white/15",
  bar = "stroke-gold-400",
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
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={track} />
        {pct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * pct} ${c}`}
            className={cx(bar, "transition-[stroke-dasharray] duration-700")}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function Progress({ value, max, className, bar = "bg-forest-500" }: { value: number; max: number; className?: string; bar?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className={cx("h-2 w-full overflow-hidden rounded-full bg-sunken", className)} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className={cx("h-full rounded-full transition-[width] duration-500", bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---------- tables ----------

export function Table({ children, minWidth = 720 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="-mx-5 overflow-x-auto sm:-mx-6">
      <table className="w-full text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cx("whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6", className)}>{children}</th>;
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx("px-3 py-3 align-middle first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6", className)}>{children}</td>;
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid, ListChecks, MonitorSmartphone, Search, Settings, Tags, Users } from "lucide-react";
import { Avatar, cx } from "@/components/ui";

const GROUPS = [
  {
    label: "Workspace",
    items: [
      { href: "/manage", label: "Today", icon: LayoutGrid },
      { href: "/manage/staff", label: "Staff", icon: Users },
      { href: "/manage/tasks", label: "Tasks", icon: ListChecks },
    ],
  },
  { label: "Team", items: [{ href: "/manage/roles", label: "Roles", icon: Tags }] },
  {
    label: "Settings",
    items: [
      { href: "/manage/settings", label: "Settings", icon: Settings },
      { href: "/kiosk", label: "Clock-in tablet", icon: MonitorSmartphone },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.items);

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/manage" ? path === "/manage" : path.startsWith(href));
}

export function SideNav() {
  const active = useActive();
  return (
    <nav className="space-y-5">
      {GROUPS.map((g) => (
        <div key={g.label}>
          <div className="mb-1 px-2.5 text-xs font-medium text-faint">{g.label}</div>
          <div className="space-y-0.5">
            {g.items.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cx(
                  "flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[14px] transition",
                  active(href) ? "bg-sunken font-medium text-ink" : "text-ink-2 hover:bg-subtle hover:text-ink",
                )}
              >
                <Icon className={cx("h-[18px] w-[18px]", active(href) ? "text-ink" : "text-muted")} strokeWidth={1.75} />
                {label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function TopNav() {
  const active = useActive();
  return (
    <nav className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-3">
      {ALL.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cx(
            "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium",
            active(href) ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink-2",
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} /> {label}
        </Link>
      ))}
    </nav>
  );
}

export interface StaffHit {
  id: string;
  name: string;
  code: string;
}

/** ⌘K / Ctrl+K quick-find for staff. Enter opens the highlighted person. */
export function StaffSearch({ staff }: { staff: StaffHit[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return staff.filter((s) => s.name.toLowerCase().includes(t) || s.code.includes(t)).slice(0, 6);
  }, [q, staff]);

  const go = (h: StaffHit) => {
    setQ("");
    setOpen(false);
    input.current?.blur();
    router.push(`/manage/staff/${h.id}`);
  };

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
      <input
        ref={input}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setSel(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setSel((i) => Math.min(i + 1, hits.length - 1));
          if (e.key === "ArrowUp") setSel((i) => Math.max(i - 1, 0));
          if (e.key === "Enter" && hits[sel]) go(hits[sel]);
          if (e.key === "Escape") input.current?.blur();
        }}
        placeholder="Search staff"
        className="h-9 w-full rounded-[10px] border border-line-strong bg-surface pl-9 pr-16 text-[13px] shadow-card outline-none placeholder:text-faint focus:border-accent-400 focus:ring-4 focus:ring-accent-100"
      />
      <span className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
        <kbd className="flex h-5 min-w-5 items-center justify-center rounded border border-line-strong bg-subtle px-1 font-sans text-[11px] text-muted">⌘</kbd>
        <kbd className="flex h-5 min-w-5 items-center justify-center rounded border border-line-strong bg-subtle px-1 font-sans text-[11px] text-muted">K</kbd>
      </span>
      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop">
          {hits.length === 0 ? (
            <div className="px-3 py-2.5 text-[13px] text-muted">No staff match “{q}”</div>
          ) : (
            hits.map((h, i) => (
              <button
                key={h.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(h)}
                onMouseEnter={() => setSel(i)}
                className={cx("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px]", i === sel && "bg-sunken")}
              >
                <Avatar name={h.name} size="sm" />
                <span className="flex-1 font-medium">{h.name}</span>
                <span className="font-mono text-xs text-muted">{h.code}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

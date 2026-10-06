"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListChecks, Settings, Tags, Users } from "lucide-react";
import { cx } from "@/components/ui";

const NAV = [
  { href: "/manage", label: "Today", icon: LayoutDashboard },
  { href: "/manage/staff", label: "Staff", icon: Users },
  { href: "/manage/tasks", label: "Tasks", icon: ListChecks },
  { href: "/manage/roles", label: "Roles", icon: Tags },
  { href: "/manage/settings", label: "Settings", icon: Settings },
];

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/manage" ? path === "/manage" : path.startsWith(href));
}

/** Vertical nav for the desktop sidebar. */
export function SideNav() {
  const active = useActive();
  return (
    <nav className="space-y-1">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cx(
            "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
            active(href) ? "bg-white/10 text-white" : "text-forest-200 hover:bg-white/5 hover:text-white",
          )}
        >
          {active(href) && <span className="absolute -left-4 top-2 bottom-2 w-1 rounded-r-full bg-gold-400" />}
          <Icon className={cx("h-[18px] w-[18px]", active(href) ? "text-gold-400" : "text-forest-200 group-hover:text-white")} strokeWidth={2} />
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Horizontal scrolling nav for small screens. */
export function TopNav() {
  const active = useActive();
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-3">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cx(
            "flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold",
            active(href) ? "bg-gold-400 text-forest-950" : "bg-white/10 text-forest-100",
          )}
        >
          <Icon className="h-4 w-4" /> {label}
        </Link>
      ))}
    </nav>
  );
}

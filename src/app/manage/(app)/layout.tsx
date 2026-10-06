import Link from "next/link";
import type { ReactNode } from "react";
import { requireManager } from "@/server/auth";
import { managerLogout } from "../login/actions";

const NAV = [
  { href: "/manage", label: "Today" },
  { href: "/manage/staff", label: "Staff" },
  { href: "/manage/tasks", label: "Tasks" },
  { href: "/manage/roles", label: "Roles" },
  { href: "/manage/settings", label: "Settings" },
];

export default async function ManageLayout({ children }: { children: ReactNode }) {
  const { employee, business } = await requireManager();
  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div>
            <div className="font-semibold">{business.name}</div>
            <div className="text-xs text-stone-500">Code {business.businessCode} · {employee.fullName}</div>
          </div>
          <nav className="flex flex-1 flex-wrap gap-1 text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-lg px-3 py-1.5 text-stone-700 hover:bg-stone-100">
                {n.label}
              </Link>
            ))}
          </nav>
          <form action={managerLogout}>
            <button className="text-sm text-stone-500 hover:text-stone-900">Log out</button>
          </form>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}

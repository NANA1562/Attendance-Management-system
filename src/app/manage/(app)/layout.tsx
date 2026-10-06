import type { ReactNode } from "react";
import { LogOut, MonitorSmartphone } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { Avatar } from "@/components/ui";
import { requireManager } from "@/server/auth";
import { managerLogout } from "../login/actions";
import { SideNav, TopNav } from "./nav";

export default async function ManageLayout({ children }: { children: ReactNode }) {
  const { employee, business } = await requireManager();

  const businessCard = (
    <div className="rounded-xl bg-white/[0.06] p-3 ring-1 ring-inset ring-white/10">
      <div className="truncate text-sm font-semibold text-white">{business.name}</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-xs text-forest-200">Tablet code</span>
        <span className="rounded-md bg-gold-400/15 px-2 py-0.5 font-mono text-xs font-bold tracking-widest text-gold-200">
          {business.businessCode}
        </span>
      </div>
    </div>
  );

  const userRow = (
    <div className="flex items-center gap-3">
      <Avatar name={employee.fullName} size="md" className="ring-2 ring-white/10" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">{employee.fullName}</div>
        <div className="text-xs text-forest-200">Senior · ID {employee.staffCode}</div>
      </div>
      <form action={managerLogout}>
        <button title="Log out" className="rounded-lg p-2 text-forest-200 hover:bg-white/10 hover:text-white">
          <LogOut className="h-4 w-4" />
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="brand-texture fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-forest-900 px-4 py-6 lg:flex">
        <Link href="/manage" className="px-2">
          <Logo tone="light" />
        </Link>
        <div className="mt-8 flex-1">
          <SideNav />
        </div>
        <div className="space-y-4">
          <Link href="/kiosk" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-forest-200 hover:bg-white/5 hover:text-white">
            <MonitorSmartphone className="h-4 w-4" /> Open clock-in tablet
          </Link>
          {businessCard}
          <div className="border-t border-white/10 pt-4">{userRow}</div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="brand-texture sticky top-0 z-20 bg-forest-900 px-4 pt-3 lg:hidden">
        <div className="mb-3 flex items-center justify-between">
          <Logo tone="light" />
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-gold-400/15 px-2 py-0.5 font-mono text-xs font-bold tracking-widest text-gold-200">{business.businessCode}</span>
            <form action={managerLogout}>
              <button title="Log out" className="rounded-lg p-2 text-forest-200 hover:bg-white/10"><LogOut className="h-4 w-4" /></button>
            </form>
          </div>
        </div>
        <TopNav />
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</main>
    </div>
  );
}

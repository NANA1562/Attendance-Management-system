import type { ReactNode } from "react";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { ChevronsUpDown, LogOut } from "lucide-react";
import Link from "next/link";
import { db } from "@/db";
import { attendance, employees } from "@/db/schema";
import { Logo } from "@/components/brand";
import { Avatar, Progress } from "@/components/ui";
import { today } from "@/server/attendance";
import { requireManager } from "@/server/auth";
import { managerLogout } from "../login/actions";
import { SideNav, StaffSearch, TopNav } from "./nav";

export default async function ManageLayout({ children }: { children: ReactNode }) {
  const { employee, business, settings } = await requireManager();
  const [staff, inToday] = await Promise.all([
    db
      .select({ id: employees.id, name: employees.fullName, code: employees.staffCode })
      .from(employees)
      .where(and(eq(employees.businessId, business.id), eq(employees.status, "active")))
      .orderBy(asc(employees.fullName)),
    db
      .select({ id: attendance.id })
      .from(attendance)
      .where(and(eq(attendance.businessId, business.id), eq(attendance.workDate, today(settings)), isNotNull(attendance.clockInAt))),
  ]);

  const workspace = (
    <Link href="/manage/settings" className="flex items-center gap-2.5 rounded-[10px] p-1.5 hover:bg-subtle">
      <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-ink text-[13px] font-semibold text-white">
        {business.name.trim()[0]?.toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold">{business.name}</span>
        <span className="block font-mono text-[11px] tracking-wider text-muted">{business.businessCode}</span>
      </span>
      <ChevronsUpDown className="h-4 w-4 text-faint" />
    </Link>
  );

  return (
    <div className="min-h-screen lg:p-2.5">
      <div className="min-h-screen lg:flex lg:min-h-[calc(100vh-20px)] lg:overflow-hidden lg:rounded-[20px] lg:border lg:border-line lg:bg-surface lg:shadow-card">
        {/* Sidebar */}
        <aside className="sticky top-2.5 hidden h-[calc(100vh-20px)] w-[260px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
          <div className="border-b border-line p-3">{workspace}</div>
          <div className="flex-1 overflow-y-auto p-3">
            <StaffSearch staff={staff} />
            <div className="mt-5">
              <SideNav />
            </div>
          </div>
          <div className="space-y-3 p-3">
            <div className="rounded-[14px] border border-line bg-subtle p-3">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted">Clocked in today</span>
                <span className="font-medium tabular-nums">{inToday.length}/{staff.length}</span>
              </div>
              <Progress value={inToday.length} max={staff.length} className="mt-2.5" />
            </div>
            <div className="flex items-center gap-2.5 rounded-[10px] p-1.5">
              <Avatar name={employee.fullName} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{employee.fullName}</div>
                <div className="text-xs text-muted">Senior · {employee.staffCode}</div>
              </div>
              <form action={managerLogout}>
                <button title="Log out" className="rounded-lg p-2 text-muted hover:bg-sunken hover:text-ink">
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </aside>

        {/* Mobile header */}
        <header className="sticky top-0 z-20 border-b border-line bg-surface/90 px-4 pt-3 backdrop-blur lg:hidden">
          <div className="mb-3 flex items-center justify-between">
            <Logo />
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-line-strong px-2 py-0.5 font-mono text-xs text-muted">{business.businessCode}</span>
              <form action={managerLogout}>
                <button title="Log out" className="rounded-lg p-2 text-muted hover:bg-sunken"><LogOut className="h-4 w-4" /></button>
              </form>
            </div>
          </div>
          <TopNav />
        </header>

        <main className="min-w-0 flex-1 lg:h-[calc(100vh-22px)] lg:overflow-y-auto">
          <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8 lg:py-7">{children}</div>
        </main>
      </div>
    </div>
  );
}

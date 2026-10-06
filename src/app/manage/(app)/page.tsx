import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobRoles } from "@/db/schema";
import { Card, Pill, Stat, StatusBadge } from "@/components/ui";
import { clock, duration, hours, prettyDate } from "@/lib/format";
import { addDays } from "@/lib/time";
import { date as dateSchema } from "@/lib/validation";
import { dayOverview, today } from "@/server/attendance";
import { requireManager } from "@/server/auth";
import { ensureForDay, listTasks, taskCounts } from "@/server/tasks";

export default async function TodayPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { business, settings } = await requireManager();
  const sp = await searchParams;
  const now = today(settings);
  const workDate = dateSchema.safeParse(sp.date).success ? sp.date! : now;
  const tz = settings.timezone;

  const { rows, counts } = await dayOverview(business.id, settings, workDate);
  // Tasks are generated for today and earlier; future days aren't created yet.
  if (workDate <= now) await ensureForDay(rows);
  const [tasks, roles] = await Promise.all([
    listTasks({ businessId: business.id, workDate }),
    db.select().from(jobRoles).where(eq(jobRoles.businessId, business.id)),
  ]);
  const tc = taskCounts(tasks);
  const roleName = (id: string | null) => roles.find((r) => r.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      {sp.welcome && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <div className="font-semibold">Your business is ready.</div>
          <div className="mt-1 text-sm">
            Business code <b className="font-mono">{business.businessCode}</b> — enter it on the tablet once. Your staff ID is{" "}
            <b className="font-mono">1001</b>. Next: <Link href="/manage/staff" className="underline">add your staff</Link>.
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{workDate === now ? "Today" : prettyDate(workDate)}</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/manage?date=${addDays(workDate, -1)}`} className="rounded-lg border border-stone-300 bg-white px-3 py-1.5">← Prev</Link>
          {workDate !== now && <Link href="/manage" className="rounded-lg border border-stone-300 bg-white px-3 py-1.5">Today</Link>}
          <Link href={`/manage?date=${addDays(workDate, 1)}`} className="rounded-lg border border-stone-300 bg-white px-3 py-1.5">Next →</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Staff" value={counts.staff} />
        <Stat label="Scheduled" value={counts.scheduled} />
        <Stat label="Present" value={counts.present} tone="text-emerald-700" />
        <Stat label="Late" value={counts.late} tone={counts.late ? "text-amber-700" : undefined} />
        <Stat label="Absent" value={counts.absent} tone={counts.absent ? "text-red-700" : undefined} />
        <Stat label="Not in yet" value={counts.notInYet} />
        <Stat label="On leave" value={counts.onLeave} />
        <Stat label="Off" value={counts.off} />
      </div>

      <Card title="Attendance">
        {rows.length === 0 ? (
          <p className="text-sm text-stone-500">No staff yet. <Link href="/manage/staff" className="underline">Add staff</Link>.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-left text-xs uppercase text-stone-500">
                <tr className="border-b border-stone-200">
                  <th className="px-5 py-2">Name</th>
                  <th className="px-2 py-2">Role</th>
                  <th className="px-2 py-2">Shift</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">In</th>
                  <th className="px-2 py-2">Out</th>
                  <th className="px-2 py-2">Break</th>
                  <th className="px-2 py-2">Hours</th>
                  <th className="px-2 py-2">Overtime</th>
                  <th className="px-2 py-2">Under</th>
                  <th className="px-5 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ employee: e, plan, result: r, lateReason }) => (
                  <tr key={e.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-5 py-2.5">
                      <Link href={`/manage/staff/${e.id}`} className="font-medium hover:underline">{e.fullName}</Link>
                      <div className="text-xs text-stone-500">ID {e.staffCode}</div>
                    </td>
                    <td className="px-2 py-2.5 text-stone-600">{roleName(e.roleId)}</td>
                    <td className="px-2 py-2.5 tabular-nums text-stone-600">
                      {plan.kind === "working" ? `${plan.start}–${plan.end}` : "—"}
                    </td>
                    <td className="px-2 py-2.5">
                      <StatusBadge status={r.status} />
                      {r.minutesLate > 0 && <div className="mt-0.5 text-xs text-stone-500">{duration(r.minutesLate)} late</div>}
                    </td>
                    <td className="px-2 py-2.5 tabular-nums">{clock(r.clockInAt, tz)}</td>
                    <td className="px-2 py-2.5 tabular-nums">{clock(r.clockOutAt, tz)}</td>
                    <td className="px-2 py-2.5 tabular-nums">{duration(r.breakMinutes)}</td>
                    <td className="px-2 py-2.5 tabular-nums">{hours(r.hoursWorked)}</td>
                    <td className="px-2 py-2.5 tabular-nums">{duration(r.overtimeMinutes)}</td>
                    <td className="px-2 py-2.5 tabular-nums">{duration(r.undertimeMinutes)}</td>
                    <td className="space-x-1 px-5 py-2.5">
                      {r.state === "working" && !r.missingClockOut && <Pill tone="bg-emerald-50 text-emerald-700">Working</Pill>}
                      {r.state === "on_break" && <Pill tone="bg-amber-100 text-amber-800">On break</Pill>}
                      {r.missingClockOut && <Pill tone="bg-red-100 text-red-800">No clock-out</Pill>}
                      {r.earlyLeaveMinutes > 0 && <Pill tone="bg-orange-50 text-orange-800">Left {duration(r.earlyLeaveMinutes)} early</Pill>}
                      {plan.kind === "working" && plan.halfDay && <Pill>Half-day leave</Pill>}
                      {lateReason && <span className="text-xs text-stone-500">“{lateReason}”</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Tasks" actions={<Link href="/manage/tasks" className="text-sm underline">Manage tasks</Link>}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Assigned" value={tc.assigned} />
          <Stat label="Completed" value={tc.completed} tone="text-emerald-700" />
          <Stat label="In progress" value={tc.inProgress} tone="text-amber-700" />
          <Stat label="Not started" value={tc.notStarted} />
          <Stat label="Required, open" value={tc.requiredOpen} tone={tc.requiredOpen ? "text-red-700" : undefined} />
        </div>
        {tasks.length > 0 && (
          <div className="mt-4 divide-y divide-stone-100">
            {rows
              .map((row) => ({ row, mine: tasks.filter((t) => t.employeeId === row.employee.id) }))
              .filter((x) => x.mine.length > 0)
              .map(({ row, mine }) => (
                <div key={row.employee.id} className="flex flex-wrap items-start gap-x-6 gap-y-1 py-3 text-sm">
                  <div className="w-40 font-medium">{row.employee.fullName}</div>
                  <div className="flex flex-1 flex-wrap gap-2">
                    {mine.map((t) => {
                      const done = t.subtasks.filter((s) => s.status === "completed").length;
                      const tone =
                        t.status === "completed" ? "bg-emerald-100 text-emerald-800" : t.status === "in_progress" ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-700";
                      return (
                        <Pill key={t.id} tone={tone}>
                          {t.title}
                          {t.subtasks.length > 0 && ` · ${done}/${t.subtasks.length}`}
                          {t.required && t.status !== "completed" && " *"}
                        </Pill>
                      );
                    })}
                  </div>
                </div>
              ))}
            <p className="pt-3 text-xs text-stone-500">* required and not finished</p>
          </div>
        )}
      </Card>
    </div>
  );
}

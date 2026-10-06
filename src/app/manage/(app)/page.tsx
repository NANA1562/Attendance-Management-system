import Link from "next/link";
import { eq } from "drizzle-orm";
import {
  AlarmClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  Hourglass,
  ListChecks,
  Lock,
  LogOut as LeftIcon,
  Sparkles,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { db } from "@/db";
import { jobRoles } from "@/db/schema";
import { Avatar, Card, cx, Empty, Progress, Ring, Stat, StatusBadge, Table, Td, Th } from "@/components/ui";
import { clock, duration, hours, prettyDate } from "@/lib/format";
import { addDays, localTime } from "@/lib/time";
import { date as dateSchema } from "@/lib/validation";
import { dayOverview, today, type DayRow } from "@/server/attendance";
import { requireManager } from "@/server/auth";
import { ensureForDay, listTasks, taskCounts, type TaskWithSubtasks } from "@/server/tasks";
import { ShiftTimeline } from "./shift-timeline";

function greeting(timeZone: string) {
  const h = Number(localTime(new Date(), timeZone).slice(0, 2));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function longDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

export default async function TodayPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { employee: me, business, settings } = await requireManager();
  const sp = await searchParams;
  const now = today(settings);
  const workDate = dateSchema.safeParse(sp.date).success ? sp.date! : now;
  const isToday = workDate === now;
  const tz = settings.timezone;

  const { rows, counts } = await dayOverview(business.id, settings, workDate);
  // Tasks are generated for today and earlier; future days aren't created yet.
  if (workDate <= now) await ensureForDay(rows);
  const [tasks, roles] = await Promise.all([
    listTasks({ businessId: business.id, workDate }),
    db.select().from(jobRoles).where(eq(jobRoles.businessId, business.id)),
  ]);
  const tc = taskCounts(tasks);
  const roleName = (id: string | null) => roles.find((r) => r.id === id)?.name ?? null;
  const expected = counts.scheduled + (rows.filter((r) => r.result.status === "worked_off_day").length);
  const workingNow = rows.filter((r) => r.result.state === "working").length;
  // Most recent clock-in or clock-out, for the hero card.
  const latest = rows
    .flatMap((r) => [
      r.result.clockInAt && { who: r.employee.fullName, what: "clocked in", at: r.result.clockInAt },
      r.result.clockOutAt && { who: r.employee.fullName, what: "clocked out", at: r.result.clockOutAt },
    ])
    .filter((x): x is { who: string; what: string; at: Date } => !!x)
    .sort((a, b) => b.at.getTime() - a.at.getTime())[0];

  return (
    <div className="space-y-6">
      {sp.welcome && (
        <div className="flex animate-fade-up flex-wrap items-center gap-4 rounded-2xl bg-gold-50 p-5 ring-1 ring-inset ring-gold-200">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-500 text-forest-950"><Sparkles className="h-5 w-5" /></span>
          <div className="flex-1">
            <div className="font-display text-lg font-semibold">Your business is ready</div>
            <div className="text-sm text-ink-2">
              Enter code <b className="font-mono tracking-widest">{business.businessCode}</b> on your clock-in tablet once. Your own staff ID is <b className="font-mono">1001</b>.
            </div>
          </div>
          <Link href="/manage/staff" className="rounded-xl bg-forest-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-700">Add your staff →</Link>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-gold-600">{isToday ? longDate(workDate) : "Looking back"}</div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-[34px]">
            {isToday ? `${greeting(tz)}, ${me.fullName.split(" ")[0]}` : longDate(workDate)}
          </h1>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1 shadow-card">
          <Link href={`/manage?date=${addDays(workDate, -1)}`} className="rounded-lg p-2 text-ink-2 hover:bg-sunken" title="Previous day"><ChevronLeft className="h-4 w-4" /></Link>
          <span className="flex items-center gap-2 px-2 text-sm font-semibold tabular-nums"><CalendarDays className="h-4 w-4 text-muted" />{prettyDate(workDate)}</span>
          <Link href={`/manage?date=${addDays(workDate, 1)}`} className="rounded-lg p-2 text-ink-2 hover:bg-sunken" title="Next day"><ChevronRight className="h-4 w-4" /></Link>
          {!isToday && <Link href="/manage" className="rounded-lg bg-forest-800 px-3 py-1.5 text-xs font-semibold text-white">Today</Link>}
        </div>
      </div>

      {/* Hero + stats */}
      <div className="grid gap-4 lg:grid-cols-12">
        <section className="brand-texture relative flex flex-col justify-between gap-6 overflow-hidden rounded-2xl bg-forest-900 p-6 text-white shadow-lift lg:col-span-5">
          <div className="flex items-center gap-6">
            <Ring value={counts.present} max={expected || 1} size={132} stroke={13}>
              <div className="font-display text-3xl font-semibold tabular-nums">{expected ? Math.round((counts.present / expected) * 100) : 0}%</div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-forest-200">present</div>
            </Ring>
            <div className="min-w-0">
              <div className="font-display text-4xl font-semibold tabular-nums">
                {counts.present}
                <span className="text-xl text-forest-200"> of {expected}</span>
              </div>
              <div className="mt-1 text-sm text-forest-100">{isToday ? "scheduled staff are in" : "scheduled staff came in"}</div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                {isToday && <span className="rounded-full bg-white/10 px-2.5 py-1">{workingNow} working now</span>}
                {counts.onBreak > 0 && <span className="rounded-full bg-gold-400/20 px-2.5 py-1 text-gold-200">{counts.onBreak} on break</span>}
                {counts.onLeave > 0 && <span className="rounded-full bg-white/10 px-2.5 py-1">{counts.onLeave} on leave</span>}
                <span className="rounded-full bg-white/10 px-2.5 py-1">{counts.off} off</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 border-t border-white/10 pt-4 text-sm">
            <span className="flex h-2 w-2 shrink-0 rounded-full bg-gold-400 shadow-[0_0_0_4px_rgb(224_179_86/0.2)]" />
            {latest ? (
              <span className="text-forest-100">
                Latest: <b className="font-semibold text-white">{latest.who}</b> {latest.what} at{" "}
                <b className="font-semibold tabular-nums text-white">{localTime(latest.at, tz)}</b>
              </span>
            ) : (
              <span className="text-forest-200">No clock-ins yet {isToday ? "today" : "this day"}.</span>
            )}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-4 lg:col-span-7">
          <Stat label="On time" value={counts.onTime} icon={CircleCheckBig} iconTone="bg-forest-50 text-ok" sub="including grace period" />
          <Stat label="Late" value={counts.late} icon={AlarmClock} iconTone="bg-amber-50 text-late" tone={counts.late ? "text-late" : undefined} sub="late or attendance risk" />
          <Stat label="Absent" value={counts.absent} icon={UserX} iconTone="bg-red-50 text-absent" tone={counts.absent ? "text-absent" : undefined} sub={`no clock-in ${settings.absentAfterMinutes / 60}h after start`} />
          <Stat label="Not in yet" value={counts.notInYet} icon={Hourglass} iconTone="bg-sunken text-ink-2" sub="still inside the window" />
        </div>
      </div>

      {/* Timeline + attention */}
      <div className="grid gap-4 xl:grid-cols-12">
        <Card title="Shift timeline" description="Scheduled shifts against actual clock-ins. Hover a bar for times." className="xl:col-span-8">
          {rows.length === 0 ? (
            <Empty title="No staff yet"><Link href="/manage/staff" className="font-semibold text-forest-700 underline">Add your first staff member</Link></Empty>
          ) : (
            <ShiftTimeline rows={rows} workDate={workDate} timeZone={tz} isToday={isToday} roleName={roleName} />
          )}
        </Card>
        <Attention rows={rows} tasks={tasks} tz={tz} className="xl:col-span-4" />
      </div>

      {/* Tasks */}
      <Card
        title="Today's work"
        description={tc.assigned ? `${tc.completed} of ${tc.assigned} tasks done` : "Tasks appear here when staff have templates for their role."}
        actions={<Link href="/manage/tasks" className="text-sm font-semibold text-forest-700 hover:underline">Manage tasks →</Link>}
      >
        {tasks.length === 0 ? (
          <Empty icon={ListChecks} title="No tasks for this day" />
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Completed", tc.completed, "text-ok"],
                ["In progress", tc.inProgress, "text-gold-700"],
                ["Not started", tc.notStarted, "text-ink"],
                ["Required, open", tc.requiredOpen, tc.requiredOpen ? "text-absent" : "text-ink"],
              ].map(([label, value, tone]) => (
                <div key={label as string} className="rounded-xl bg-canvas px-4 py-3">
                  <div className="text-xs font-semibold text-muted">{label}</div>
                  <div className={cx("font-display text-2xl font-semibold tabular-nums", tone as string)}>{value}</div>
                </div>
              ))}
            </div>
            <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
              {rows
                .map((row) => ({ row, mine: tasks.filter((t) => t.employeeId === row.employee.id) }))
                .filter((x) => x.mine.length > 0)
                .map(({ row, mine }) => {
                  const done = mine.filter((t) => t.status === "completed").length;
                  return (
                    <div key={row.employee.id}>
                      <div className="mb-2 flex items-center gap-3">
                        <Avatar name={row.employee.fullName} size="sm" />
                        <span className="flex-1 text-sm font-semibold">{row.employee.fullName}</span>
                        <span className="text-xs font-semibold tabular-nums text-muted">{done}/{mine.length}</span>
                      </div>
                      <Progress value={done} max={mine.length} />
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {mine.map((t) => {
                          const sd = t.subtasks.filter((s) => s.status === "completed").length;
                          return (
                            <span
                              key={t.id}
                              className={cx(
                                "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ring-1 ring-inset",
                                t.status === "completed" ? "bg-forest-50 text-forest-700 ring-forest-200" : t.status === "in_progress" ? "bg-gold-50 text-gold-700 ring-gold-200" : "bg-surface text-ink-2 ring-line-strong",
                              )}
                            >
                              {t.status === "completed" && <CircleCheckBig className="h-3 w-3" />}
                              {t.title}
                              {t.subtasks.length > 0 && <span className="tabular-nums opacity-70">{sd}/{t.subtasks.length}</span>}
                              {t.required && t.status !== "completed" && <span className="text-absent" title="Required">•</span>}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </Card>

      {/* Detail table (also the accessible table view of the timeline) */}
      <Card title="Attendance details" padded>
        <Table minWidth={900}>
          <thead className="border-b border-line">
            <tr>
              <Th>Name</Th><Th>Status</Th><Th>Shift</Th><Th>In</Th><Th>Out</Th><Th>Break</Th><Th>Hours</Th><Th>Overtime</Th><Th>Under</Th><Th>Notes</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ employee: e, plan, result: r, lateReason }) => (
              <tr key={e.id} className="hover:bg-canvas/60">
                <Td>
                  <Link href={`/manage/staff/${e.id}`} className="flex items-center gap-3 font-semibold hover:underline">
                    <Avatar name={e.fullName} size="sm" /> {e.fullName}
                  </Link>
                </Td>
                <Td>
                  <StatusBadge status={r.status} />
                  {r.minutesLate > 0 && <div className="mt-1 text-xs text-muted">{duration(r.minutesLate)} late</div>}
                </Td>
                <Td className="tabular-nums text-ink-2">{plan.kind === "working" ? `${plan.start}–${plan.end}` : "—"}</Td>
                <Td className="tabular-nums font-medium">{clock(r.clockInAt, tz)}</Td>
                <Td className="tabular-nums font-medium">{clock(r.clockOutAt, tz)}</Td>
                <Td className="tabular-nums text-ink-2">{duration(r.breakMinutes)}</Td>
                <Td className="tabular-nums font-semibold">{hours(r.hoursWorked)}</Td>
                <Td className="tabular-nums text-ok">{r.overtimeMinutes ? `+${duration(r.overtimeMinutes)}` : "—"}</Td>
                <Td className="tabular-nums text-late">{r.undertimeMinutes ? `−${duration(r.undertimeMinutes)}` : "—"}</Td>
                <Td className="max-w-[220px] text-xs text-ink-2">
                  <div className="flex flex-wrap gap-1">
                    {r.missingClockOut && <span className="rounded bg-red-50 px-1.5 py-0.5 font-semibold text-absent">No clock-out</span>}
                    {r.earlyLeaveMinutes > 0 && <span className="rounded bg-amber-50 px-1.5 py-0.5 font-semibold text-late">Left {duration(r.earlyLeaveMinutes)} early</span>}
                    {plan.kind === "working" && plan.halfDay && <span className="rounded bg-violet-50 px-1.5 py-0.5 font-semibold text-leave">Half-day leave</span>}
                  </div>
                  {lateReason && <div className="mt-1 italic">“{lateReason}”</div>}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

function Attention({ rows, tasks, tz, className }: { rows: DayRow[]; tasks: TaskWithSubtasks[]; tz: string; className?: string }) {
  const items: { key: string; icon: LucideIcon; tone: string; name: string; id: string; text: string }[] = [];
  const now = new Date();
  for (const r of rows) {
    const e = r.employee;
    const first = e.fullName.split(" ")[0];
    if (r.result.missingClockOut) items.push({ key: `mc-${e.id}`, icon: LeftIcon, tone: "bg-red-50 text-absent", name: e.fullName, id: e.id, text: `${first} never clocked out` });
    if (r.result.status === "absent") items.push({ key: `ab-${e.id}`, icon: UserX, tone: "bg-red-50 text-absent", name: e.fullName, id: e.id, text: `${first} is absent` });
    if (r.result.status === "attendance_risk" || r.result.status === "late") {
      items.push({
        key: `lt-${e.id}`,
        icon: AlarmClock,
        tone: "bg-amber-50 text-late",
        name: e.fullName,
        id: e.id,
        text: `${first} was ${duration(r.result.minutesLate)} late${r.lateReason ? "" : " · no reason given"}`,
      });
    }
    if (e.lockedUntil && e.lockedUntil > now) {
      items.push({ key: `lk-${e.id}`, icon: Lock, tone: "bg-sunken text-ink-2", name: e.fullName, id: e.id, text: `${first} is locked out until ${localTime(e.lockedUntil, tz)}` });
    }
  }
  const openRequired = tasks.filter((t) => t.required && t.status !== "completed").length;

  return (
    <Card title="Needs attention" description={items.length ? `${items.length} item${items.length === 1 ? "" : "s"}` : undefined} className={className}>
      {items.length === 0 && openRequired === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <span className="flex h-12 w-12 animate-pop items-center justify-center rounded-full bg-forest-50 text-ok"><CircleCheckBig className="h-6 w-6" /></span>
          <div className="mt-3 font-semibold">All clear</div>
          <div className="text-sm text-muted">Nothing needs you right now.</div>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map(({ key, icon: Icon, tone, name, id, text }) => (
            <li key={key}>
              <Link href={`/manage/staff/${id}`} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-canvas">
                <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tone)}><Icon className="h-4 w-4" /></span>
                <span className="flex-1 text-sm font-medium text-ink">{text}</span>
                <Avatar name={name} size="sm" />
              </Link>
            </li>
          ))}
          {openRequired > 0 && (
            <li>
              <Link href="/manage/tasks" className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-canvas">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-50 text-gold-700"><ListChecks className="h-4 w-4" /></span>
                <span className="flex-1 text-sm font-medium">{openRequired} required task{openRequired === 1 ? "" : "s"} still open</span>
              </Link>
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}

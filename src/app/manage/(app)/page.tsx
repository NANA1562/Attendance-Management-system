import Link from "next/link";
import { eq } from "drizzle-orm";
import {
  AlarmClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  ListChecks,
  Lock,
  LogOut as LeftIcon,
  MonitorSmartphone,
  Sparkles,
  Trophy,
  UserCheck,
  UserX,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import { db } from "@/db";
import { jobRoles } from "@/db/schema";
import { Avatar, Card, Chip, cx, Delta, Empty, Person, Progress, Ring, Stat, StatusBadge, Table, Td, Th } from "@/components/ui";
import { clock, duration, hours, prettyDate } from "@/lib/format";
import { addDays, localTime } from "@/lib/time";
import { date as dateSchema } from "@/lib/validation";
import { dayOverview, rangeOverview, today, type DayRow } from "@/server/attendance";
import { requireManager } from "@/server/auth";
import { ensureForDay, listTasks, taskCounts, type TaskWithSubtasks } from "@/server/tasks";
import { ShiftTimeline } from "./shift-timeline";
import { TrendChart } from "./trend-chart";

function greeting(timeZone: string) {
  const h = Number(localTime(new Date(), timeZone).slice(0, 2));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function TodayPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { employee: me, business, settings } = await requireManager();
  const sp = await searchParams;
  const now = today(settings);
  const workDate = dateSchema.safeParse(sp.date).success ? sp.date! : now;
  const isToday = workDate === now;
  const metric = sp.metric === "ontime" ? "ontime" : "present";
  const tz = settings.timezone;
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...(workDate !== now ? { date: workDate } : {}), ...(metric !== "present" ? { metric } : {}), ...extra });
    const str = p.toString();
    return str ? `/manage?${str}` : "/manage";
  };

  const [{ rows, counts }, range] = await Promise.all([
    dayOverview(business.id, settings, workDate),
    rangeOverview(business.id, settings, addDays(workDate, -13), workDate),
  ]);
  if (workDate <= now) await ensureForDay(rows);
  const [tasks, roles] = await Promise.all([
    listTasks({ businessId: business.id, workDate }),
    db.select().from(jobRoles).where(eq(jobRoles.businessId, business.id)),
  ]);
  const tc = taskCounts(tasks);
  const roleName = (id: string | null) => roles.find((r) => r.id === id)?.name ?? null;

  // The previous scheduled day in the range, for the deltas.
  const prev = [...range.days].reverse().find((d) => d.date < workDate && d.scheduled > 0) ?? null;
  const delta = (a: number, b: number | undefined) => (prev && b !== undefined ? a - b : null);

  const leaderboard = range.people
    .filter((p) => p.scheduledDays > 0)
    .map((p) => ({ ...p, rate: Math.round((p.onTimeDays / p.scheduledDays) * 100) }))
    .sort((a, b) => b.rate - a.rate || b.minutesWorked - a.minutesWorked)
    .slice(0, 6);

  return (
    <div className="space-y-5">
      {sp.welcome && (
        <div className="flex animate-fade-up flex-wrap items-center gap-4 rounded-[14px] border border-accent-200 bg-accent-50 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent-600 text-white"><Sparkles className="h-4 w-4" /></span>
          <div className="flex-1 text-[13px]">
            <div className="font-semibold text-ink">Your business is ready</div>
            <div className="text-ink-2">
              Enter code <b className="font-mono">{business.businessCode}</b> on your clock-in tablet once. Your staff ID is <b className="font-mono">1001</b>.
            </div>
          </div>
          <Link href="/manage/staff" className="inline-flex h-9 items-center rounded-[10px] bg-ink px-3.5 text-[13px] font-medium text-white">Add your staff</Link>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-line-strong bg-surface shadow-card">
            <LayoutGrid className="h-[18px] w-[18px] text-ink-2" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight">{isToday ? "Today" : prettyDate(workDate)}</h1>
            <p className="text-[13px] text-muted">{isToday ? `${greeting(tz)}, ${me.fullName.split(" ")[0]}. Here's your team right now.` : "Looking back at this day."}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip href={qs({ date: addDays(workDate, -1) })} icon={ChevronLeft} title="Previous day" className="px-2.5" />
          <Chip icon={CalendarDays}>{isToday ? `Today, ${prettyDate(workDate)}` : prettyDate(workDate)}</Chip>
          <Chip href={qs({ date: addDays(workDate, 1) })} icon={ChevronRight} title="Next day" className="px-2.5" />
          {!isToday && <Chip href="/manage" active>Back to today</Chip>}
          <Chip href="/kiosk" icon={MonitorSmartphone}>Open tablet</Chip>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          label="Present"
          icon={UserCheck}
          value={`${counts.present}/${counts.scheduled}`}
          ring={{ value: counts.present, max: counts.scheduled || 1 }}
          delta={<Delta value={delta(counts.present, prev?.present)} />}
          sub={counts.onBreak ? `${counts.onBreak} on break now` : `${counts.off} off · ${counts.onLeave} on leave`}
        />
        <Stat
          label="On time"
          icon={CircleCheckBig}
          value={counts.onTime}
          ring={{ value: counts.onTime, max: counts.present || 1, bar: "stroke-ok" }}
          delta={<Delta value={delta(counts.onTime, prev?.onTime)} />}
          sub="including the grace period"
        />
        <Stat
          label="Late"
          icon={AlarmClock}
          value={counts.late}
          delta={<Delta value={delta(counts.late, prev?.late)} goodWhenUp={false} />}
          sub="late or attendance risk"
        />
        <Stat
          label="Absent"
          icon={UserX}
          value={counts.absent}
          delta={<Delta value={delta(counts.absent, prev?.absent)} goodWhenUp={false} />}
          sub={counts.notInYet ? `${counts.notInYet} not in yet` : `no clock-in ${settings.absentAfterMinutes / 60}h after start`}
        />
      </div>

      {/* Trend + leaderboard */}
      <div className="grid gap-3 xl:grid-cols-12">
        <Card
          className="xl:col-span-7"
          title="Attendance"
          actions={
            <div className="flex rounded-[10px] bg-sunken p-0.5 text-[13px]">
              {(["present", "ontime"] as const).map((m) => (
                <Link
                  key={m}
                  href={qs({ metric: m })}
                  className={cx("rounded-lg px-3 py-1 font-medium transition", metric === m ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink")}
                >
                  {m === "present" ? "Present" : "On time"}
                </Link>
              ))}
            </div>
          }
        >
          <TrendChart days={range.days} metric={metric} />
          <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
            <span>Showing the last 14 days · working days only</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-accent-600" /> {metric === "present" ? "% of scheduled staff present" : "% of scheduled staff on time"}</span>
          </div>
        </Card>

        <Card className="xl:col-span-5" title="Punctuality leaderboard" description="On-time arrivals, last 14 days" flush>
          {leaderboard.length === 0 ? (
            <div className="p-5"><Empty icon={Trophy} title="Not enough history yet" /></div>
          ) : (
            <Table minWidth={360}>
              <thead>
                <tr><Th className="w-10">#</Th><Th>Staff</Th><Th>On time</Th><Th className="text-right">Days</Th></tr>
              </thead>
              <tbody>
                {leaderboard.map((p, i) => (
                  <tr key={p.employee.id} className="hover:bg-subtle">
                    <Td className="font-mono text-muted">{i + 1}</Td>
                    <Td>
                      <span className="flex items-center gap-2">
                        <Person name={p.employee.fullName} href={`/manage/staff/${p.employee.id}`} />
                        {p.employee.id === me.id && <span className="rounded-md bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-700">You</span>}
                      </span>
                    </Td>
                    <Td>
                      <span className="flex items-center gap-2 tabular-nums">
                        <Ring value={p.onTimeDays} max={p.scheduledDays} size={16} stroke={2.5} bar={p.rate >= 75 ? "stroke-ok" : p.rate >= 50 ? "stroke-late" : "stroke-absent"} />
                        {p.rate}%
                      </span>
                    </Td>
                    <Td className="text-right tabular-nums text-muted">{p.onTimeDays}/{p.scheduledDays}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      {/* Timeline + attention */}
      <div className="grid gap-3 xl:grid-cols-12">
        <Card title="Shift timeline" description="Scheduled shifts against actual clock-ins. Hover a bar for exact times." className="xl:col-span-8">
          {rows.length === 0 ? (
            <Empty title="No staff yet"><Link href="/manage/staff" className="font-medium text-ink underline">Add your first staff member</Link></Empty>
          ) : (
            <ShiftTimeline rows={rows} workDate={workDate} timeZone={tz} isToday={isToday} roleName={roleName} />
          )}
        </Card>
        <Attention rows={rows} tasks={tasks} tz={tz} className="xl:col-span-4" />
      </div>

      {/* Tasks */}
      <Card
        title="Today's work"
        description={tc.assigned ? `${tc.completed} of ${tc.assigned} tasks done${tc.requiredOpen ? ` · ${tc.requiredOpen} required still open` : ""}` : "Tasks appear when staff have templates for their role."}
        actions={<Chip href="/manage/tasks" icon={ListChecks}>Open board</Chip>}
      >
        {tasks.length === 0 ? (
          <Empty icon={ListChecks} title="No tasks for this day" />
        ) : (
          <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
            {rows
              .map((row) => ({ row, mine: tasks.filter((t) => t.employeeId === row.employee.id) }))
              .filter((x) => x.mine.length > 0)
              .map(({ row, mine }) => {
                const done = mine.filter((t) => t.status === "completed").length;
                return (
                  <div key={row.employee.id}>
                    <div className="mb-2 flex items-center gap-3">
                      <Person name={row.employee.fullName} href={`/manage/staff/${row.employee.id}`} />
                      <span className="flex-1" />
                      <span className="font-mono text-xs tabular-nums text-muted">{done}/{mine.length}</span>
                    </div>
                    <Progress value={done} max={mine.length} />
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {mine.map((t) => {
                        const sd = t.subtasks.filter((s) => s.status === "completed").length;
                        return (
                          <span
                            key={t.id}
                            className={cx(
                              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                              t.status === "completed" ? "bg-green-50 text-green-700 ring-green-200/70" : t.status === "in_progress" ? "bg-amber-50 text-amber-700 ring-amber-200/70" : "bg-surface text-ink-2 ring-line-strong",
                            )}
                          >
                            {t.title}
                            {t.subtasks.length > 0 && <span className="font-mono opacity-70">{sd}/{t.subtasks.length}</span>}
                            {t.required && t.status !== "completed" && <span className="text-absent" title="Required">•</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </Card>

      {/* Detail table (also the table view of the timeline) */}
      <Card title="Attendance details" description="Everything for the day in one table." flush>
        <Table minWidth={960}>
          <thead>
            <tr>
              <Th>Name</Th><Th>Status</Th><Th>Shift</Th><Th>In</Th><Th>Out</Th><Th>Break</Th><Th>Hours</Th><Th>Overtime</Th><Th>Under</Th><Th>Notes</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ employee: e, plan, result: r, lateReason }) => (
              <tr key={e.id} className="hover:bg-subtle">
                <Td><Person name={e.fullName} href={`/manage/staff/${e.id}`} /></Td>
                <Td>
                  <StatusBadge status={r.status} />
                  {r.minutesLate > 0 && <div className="mt-1 text-xs text-muted">{duration(r.minutesLate)} late</div>}
                </Td>
                <Td className="font-mono tabular-nums text-ink-2">{plan.kind === "working" ? `${plan.start}–${plan.end}` : "—"}</Td>
                <Td className="font-mono tabular-nums">{clock(r.clockInAt, tz)}</Td>
                <Td className="font-mono tabular-nums">{clock(r.clockOutAt, tz)}</Td>
                <Td className="tabular-nums text-ink-2">{duration(r.breakMinutes)}</Td>
                <Td className="font-medium tabular-nums">{hours(r.hoursWorked)}</Td>
                <Td className="tabular-nums text-ok">{r.overtimeMinutes ? `+${duration(r.overtimeMinutes)}` : <span className="text-faint">—</span>}</Td>
                <Td className="tabular-nums text-late">{r.undertimeMinutes ? `−${duration(r.undertimeMinutes)}` : <span className="text-faint">—</span>}</Td>
                <Td className="max-w-[240px] text-xs text-ink-2">
                  <div className="flex flex-wrap gap-1">
                    {r.missingClockOut && <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700 ring-1 ring-inset ring-red-200/70">No clock-out</span>}
                    {r.earlyLeaveMinutes > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 ring-1 ring-inset ring-amber-200/70">Left {duration(r.earlyLeaveMinutes)} early</span>}
                    {plan.kind === "working" && plan.halfDay && <span className="rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-700 ring-1 ring-inset ring-sky-200/70">Half-day leave</span>}
                  </div>
                  {lateReason && <div className="mt-1 italic text-muted">“{lateReason}”</div>}
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
    if (r.result.missingClockOut) items.push({ key: `mc-${e.id}`, icon: LeftIcon, tone: "text-absent", name: e.fullName, id: e.id, text: `${first} never clocked out` });
    if (r.result.status === "absent") items.push({ key: `ab-${e.id}`, icon: UserX, tone: "text-absent", name: e.fullName, id: e.id, text: `${first} is absent` });
    if (r.result.status === "attendance_risk" || r.result.status === "late") {
      items.push({ key: `lt-${e.id}`, icon: AlarmClock, tone: "text-late", name: e.fullName, id: e.id, text: `${first} was ${duration(r.result.minutesLate)} late${r.lateReason ? "" : ", no reason"}` });
    }
    if (e.lockedUntil && e.lockedUntil > now) {
      items.push({ key: `lk-${e.id}`, icon: Lock, tone: "text-muted", name: e.fullName, id: e.id, text: `${first} locked out until ${localTime(e.lockedUntil, tz)}` });
    }
  }
  const openRequired = tasks.filter((t) => t.required && t.status !== "completed").length;
  const total = items.length + (openRequired ? 1 : 0);

  return (
    <Card title="Needs attention" description={total ? `${total} item${total === 1 ? "" : "s"}` : "Nothing waiting on you"} className={className}>
      {total === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <span className="flex h-11 w-11 animate-pop items-center justify-center rounded-full bg-green-50 text-ok ring-1 ring-inset ring-green-200"><CircleCheckBig className="h-5 w-5" /></span>
          <div className="mt-3 text-[13px] font-semibold">All clear</div>
          <div className="text-[13px] text-muted">Nothing needs you right now.</div>
        </div>
      ) : (
        <ul className="-mx-2 space-y-0.5">
          {items.map(({ key, icon: Icon, tone, name, id, text }) => (
            <li key={key}>
              <Link href={`/manage/staff/${id}`} className="flex items-center gap-3 rounded-[10px] px-2 py-2 transition hover:bg-subtle">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-line-strong bg-surface shadow-card">
                  <Icon className={cx("h-4 w-4", tone)} strokeWidth={1.75} />
                </span>
                <span className="flex-1 text-[13px] text-ink">{text}</span>
                <Avatar name={name} size="sm" />
              </Link>
            </li>
          ))}
          {openRequired > 0 && (
            <li>
              <Link href="/manage/tasks" className="flex items-center gap-3 rounded-[10px] px-2 py-2 transition hover:bg-subtle">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-line-strong bg-surface shadow-card"><ListChecks className="h-4 w-4 text-late" strokeWidth={1.75} /></span>
                <span className="flex-1 text-[13px]">{openRequired} required task{openRequired === 1 ? "" : "s"} still open</span>
              </Link>
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}

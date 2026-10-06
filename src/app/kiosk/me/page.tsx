import { eq } from "drizzle-orm";
import { Check, Coffee, LogIn, LogOut, Play, type LucideIcon } from "lucide-react";
import { db } from "@/db";
import { jobRoles } from "@/db/schema";
import { Logo } from "@/components/brand";
import { FormButton, TickButton } from "@/components/form-button";
import { Avatar, Card, cx, Pill, Progress, Ring, StatusBadge, TaskBadge } from "@/components/ui";
import { allowedActions, type EventType } from "@/lib/attendance/engine";
import { clock, duration, hours, STATUS_LABEL } from "@/lib/format";
import { localTime } from "@/lib/time";
import { employeeToday } from "@/server/attendance";
import { requireStaff } from "@/server/auth";
import { ensureForDay, listTasks } from "@/server/tasks";
import { doneOnTablet, lateReason, tap, toggleSubtask, updateTask } from "../actions";
import { IdleReturn } from "./idle-return";

const ACTION: Record<EventType, { label: string; hint: string; variant: "green" | "amber" | "red"; icon: LucideIcon }> = {
  clock_in: { label: "Clock in", hint: "Start your day", variant: "green", icon: LogIn },
  break_start: { label: "Start break", hint: "Pause the clock", variant: "amber", icon: Coffee },
  break_end: { label: "End break", hint: "Back to work", variant: "green", icon: Play },
  clock_out: { label: "Clock out", hint: "Finish for today", variant: "red", icon: LogOut },
};

const DONE_MESSAGE: Record<EventType, string> = {
  clock_in: "You're clocked in",
  break_start: "Enjoy your break",
  break_end: "Welcome back",
  clock_out: "You're clocked out. See you next time",
};

function greeting(timeZone: string) {
  const h = Number(localTime(new Date(), timeZone).slice(0, 2));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function KioskMePage({ searchParams }: PageProps<"/kiosk/me">) {
  const { employee, settings, business } = await requireStaff();
  const { done, error } = (await searchParams) as { done?: EventType; error?: string };
  const tz = settings.timezone;

  const [day, role] = await Promise.all([
    employeeToday(employee, settings),
    employee.roleId ? db.select().from(jobRoles).where(eq(jobRoles.id, employee.roleId)).then((x) => x[0]) : null,
  ]);
  const r = day.result;
  await ensureForDay([day]);
  const tasks = await listTasks({ businessId: employee.businessId, workDate: day.workDate, employeeId: employee.id });
  const actions = allowedActions(r.state);
  const askLateReason = (r.status === "late" || r.status === "attendance_risk") && !day.lateReason;
  const tasksDone = tasks.filter((t) => t.status === "completed").length;

  const shift =
    day.plan.kind === "working"
      ? `${day.plan.start} – ${day.plan.end}${day.plan.halfDay ? " · half day" : ""}`
      : day.plan.kind === "leave"
        ? "On leave today"
        : "Day off";

  return (
    <main className="dot-grid min-h-screen px-4 py-5 sm:px-8">
      <IdleReturn seconds={done === "clock_out" ? 10 : 45} />
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden h-5 w-px bg-line-strong sm:block" />
            <span className="hidden text-[14px] font-medium text-ink-2 sm:block">{business.name}</span>
          </div>
          <form action={doneOnTablet}>
            <FormButton variant="secondary" className="h-10 px-4">
              <Check className="h-4 w-4" /> Done
            </FormButton>
          </form>
        </header>

        {done && DONE_MESSAGE[done] && (
          <div className="flex animate-fade-up items-center gap-4 rounded-[18px] border border-green-200 bg-green-50 p-4">
            <span className="flex h-11 w-11 shrink-0 animate-pop items-center justify-center rounded-full bg-ok text-white">
              <Check className="h-6 w-6" strokeWidth={3} />
            </span>
            <div>
              <div className="text-[16px] font-semibold text-green-900">{DONE_MESSAGE[done]}</div>
              <div className="text-[13px] text-green-800">
                {done === "clock_in" && r.status !== "not_in_yet" && `${clock(r.clockInAt, tz)} · ${STATUS_LABEL[r.status]}`}
                {done === "clock_out" && r.hoursWorked !== null && `${hours(r.hoursWorked)} worked today`}
                {(done === "break_start" || done === "break_end") && `Recorded at ${localTime(new Date(), tz)}`}
              </div>
            </div>
          </div>
        )}
        {error && <div className="rounded-[14px] border border-red-200 bg-red-50 p-4 text-[14px] font-medium text-red-700">{error}</div>}

        {/* Main card */}
        <Card bodyClassName="p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar name={employee.fullName} size="lg" />
              <div>
                <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{greeting(tz)}, {employee.fullName.split(" ")[0]}</h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Pill>{role?.name ?? (employee.level === "senior" ? "Senior" : "Staff")}</Pill>
                  <Pill><span className="font-mono">{shift}</span></Pill>
                  {r.clockInAt && <StatusBadge status={r.status} />}
                  {r.state === "on_break" && <Pill tone="bg-amber-50 text-amber-700 ring-amber-200/70">On break</Pill>}
                </div>
              </div>
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-3 gap-2.5">
            {[
              ["Clocked in", clock(r.clockInAt, tz), r.minutesLate > 0 ? `${duration(r.minutesLate)} late` : null],
              ["Break", duration(r.breakMinutes), r.state === "on_break" ? "running" : null],
              ["Clocked out", clock(r.clockOutAt, tz), r.hoursWorked !== null ? `${hours(r.hoursWorked)} worked` : null],
            ].map(([label, value, sub]) => (
              <div key={label} className="rounded-[14px] border border-line bg-subtle p-4">
                <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{label}</dt>
                <dd className="mt-1.5 text-[28px] font-semibold leading-none tracking-tight tabular-nums">{value}</dd>
                <dd className="mt-1.5 h-4 text-xs text-muted">{sub}</dd>
              </div>
            ))}
          </dl>

          {actions.length > 0 ? (
            <div className={cx("mt-5 grid gap-2.5", actions.length > 1 && "sm:grid-cols-2")}>
              {actions.map((a) => {
                const { label, hint, variant, icon: Icon } = ACTION[a];
                return (
                  <form key={a} action={tap}>
                    <input type="hidden" name="type" value={a} />
                    <FormButton variant={variant} pendingLabel="Saving…" className="h-[88px] w-full justify-start gap-4 rounded-[18px] px-5 text-left">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-white/15">
                        <Icon className="h-6 w-6" />
                      </span>
                      <span>
                        <span className="block text-[22px] font-semibold">{label}</span>
                        <span className="block text-[13px] font-normal opacity-80">{hint}</span>
                      </span>
                    </FormButton>
                  </form>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-[18px] border border-line bg-subtle p-6 text-center">
              <div className="text-[18px] font-semibold">That's a wrap for today</div>
              <div className="mt-1 text-[14px] text-muted">{r.hoursWorked !== null && `${hours(r.hoursWorked)} worked. `}Thank you!</div>
            </div>
          )}

          {askLateReason && (
            <form action={lateReason} className="mt-3 flex gap-2">
              <input
                name="reason"
                placeholder="Running late? Tell your manager why (optional)"
                className="h-11 flex-1 rounded-[12px] border border-line-strong bg-surface px-3.5 text-[14px] shadow-card outline-none placeholder:text-faint focus:border-accent-400 focus:ring-4 focus:ring-accent-100"
              />
              <FormButton variant="primary" className="h-11 px-5">Send</FormButton>
            </form>
          )}
        </Card>

        {/* Tasks */}
        <Card
          title="My tasks today"
          description={tasks.length ? `${tasksDone} of ${tasks.length} done` : "Nothing assigned for today."}
          actions={tasks.length > 0 ? (
            <Ring value={tasksDone} max={tasks.length} size={44} stroke={5} bar="stroke-ok">
              <span className="text-[11px] font-semibold tabular-nums">{Math.round((tasksDone / tasks.length) * 100)}%</span>
            </Ring>
          ) : undefined}
        >
          <div className="space-y-2.5">
            {tasks.map((t) => {
              const doneCount = t.subtasks.filter((s) => s.status === "completed").length;
              return (
                <article key={t.id} className="overflow-hidden rounded-[14px] border border-line">
                  <header className="flex items-center justify-between gap-3 border-b border-line bg-subtle px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold">{t.title}</div>
                      {t.description && <div className="text-[13px] text-muted">{t.description}</div>}
                    </div>
                    <TaskBadge status={t.status} />
                  </header>
                  <div className="px-3 py-2">
                    {t.subtasks.length > 0 ? (
                      <>
                        <div className="flex items-center gap-3 px-2 pb-1 pt-1.5">
                          <Progress value={doneCount} max={t.subtasks.length} />
                          <span className="font-mono text-xs text-muted">{doneCount}/{t.subtasks.length}</span>
                        </div>
                        <ul>
                          {t.subtasks.map((s) => (
                            <li key={s.id}>
                              <form action={toggleSubtask}>
                                <input type="hidden" name="id" value={s.id} />
                                <input type="hidden" name="done" value={s.status === "completed" ? "0" : "1"} />
                                <TickButton done={s.status === "completed"} label={s.title} />
                              </form>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : t.status !== "completed" ? (
                      <form action={updateTask} className="p-1.5">
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="status" value="completed" />
                        <FormButton variant="primary" pendingLabel="Saving…" className="h-10 px-4">
                          <Check className="h-4 w-4" /> Mark done
                        </FormButton>
                      </form>
                    ) : (
                      <div className="px-2 py-2 text-[13px] text-muted">Completed{t.completedAt && ` at ${localTime(t.completedAt, tz)}`}</div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </Card>
      </div>
    </main>
  );
}

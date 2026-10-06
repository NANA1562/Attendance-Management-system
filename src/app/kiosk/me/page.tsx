import { eq } from "drizzle-orm";
import { Check, Coffee, LogIn, LogOut, Play, type LucideIcon } from "lucide-react";
import { db } from "@/db";
import { jobRoles } from "@/db/schema";
import { Logo } from "@/components/brand";
import { FormButton, TickButton } from "@/components/form-button";
import { cx, Progress, Ring, StatusBadge, TaskBadge } from "@/components/ui";
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
    <main className="min-h-screen bg-canvas">
      <IdleReturn seconds={done === "clock_out" ? 10 : 45} />

      {/* Hero */}
      <section className="brand-texture bg-forest-950 px-6 pb-16 pt-6 text-white sm:px-10">
        <div className="mx-auto max-w-3xl">
          <header className="flex items-center justify-between gap-4">
            <Logo tone="light" />
            <form action={doneOnTablet}>
              <FormButton variant="secondary" className="border-white/20 bg-white/10 px-5 text-white hover:bg-white/20">
                <Check className="h-4 w-4" /> Done
              </FormButton>
            </form>
          </header>

          {done && DONE_MESSAGE[done] && (
            <div className="mt-8 flex animate-fade-up items-center gap-4 rounded-2xl bg-white/[0.07] p-4 ring-1 ring-inset ring-white/10">
              <span className="flex h-12 w-12 shrink-0 animate-pop items-center justify-center rounded-full bg-gold-400 text-forest-950">
                <Check className="h-7 w-7" strokeWidth={3} />
              </span>
              <div>
                <div className="text-lg font-bold">{DONE_MESSAGE[done]}</div>
                <div className="text-sm text-forest-100">
                  {done === "clock_in" && r.status !== "not_in_yet" && `${clock(r.clockInAt, tz)} · ${STATUS_LABEL[r.status]}`}
                  {done === "clock_out" && r.hoursWorked !== null && `${hours(r.hoursWorked)} worked today`}
                  {(done === "break_start" || done === "break_end") && `Recorded at ${localTime(new Date(), tz)}`}
                </div>
              </div>
            </div>
          )}
          {error && <div className="mt-8 rounded-2xl bg-red-500/15 p-4 font-semibold text-red-200 ring-1 ring-inset ring-red-400/30">{error}</div>}

          <div className="mt-8">
            <div className="text-sm font-semibold uppercase tracking-[0.14em] text-gold-400">{business.name}</div>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              {greeting(tz)}, {employee.fullName.split(" ")[0]}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-white/10 px-3 py-1 font-semibold">{role?.name ?? (employee.level === "senior" ? "Senior" : "Staff")}</span>
              <span className="rounded-full bg-white/10 px-3 py-1 font-semibold tabular-nums">{shift}</span>
              {r.clockInAt && <StatusBadge status={r.status} />}
              {r.state === "on_break" && <span className="rounded-full bg-gold-400 px-3 py-1 font-bold text-forest-950">On break</span>}
            </div>
          </div>

          <dl className="mt-8 grid grid-cols-3 gap-3">
            {[
              ["Clocked in", clock(r.clockInAt, tz), r.minutesLate > 0 ? `${duration(r.minutesLate)} late` : null],
              ["Break", duration(r.breakMinutes), r.state === "on_break" ? "running" : null],
              ["Clocked out", clock(r.clockOutAt, tz), r.hoursWorked !== null ? `${hours(r.hoursWorked)} worked` : null],
            ].map(([label, value, sub]) => (
              <div key={label} className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-inset ring-white/10">
                <dt className="text-xs font-semibold uppercase tracking-wider text-forest-200">{label}</dt>
                <dd className="mt-1 font-display text-3xl font-semibold tabular-nums">{value}</dd>
                <dd className="h-4 text-xs text-gold-200">{sub}</dd>
              </div>
            ))}
          </dl>

          {actions.length > 0 ? (
            <div className={cx("mt-6 grid gap-3", actions.length > 1 && "sm:grid-cols-2")}>
              {actions.map((a) => {
                const { label, hint, variant, icon: Icon } = ACTION[a];
                return (
                  <form key={a} action={tap}>
                    <input type="hidden" name="type" value={a} />
                    <FormButton variant={variant} pendingLabel="Saving…" className="h-24 w-full justify-start gap-4 rounded-3xl px-6 text-left">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black/10">
                        <Icon className="h-6 w-6" />
                      </span>
                      <span>
                        <span className="block text-2xl font-bold">{label}</span>
                        <span className="block text-sm font-medium opacity-80">{hint}</span>
                      </span>
                    </FormButton>
                  </form>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-3xl bg-white/[0.06] p-6 text-center ring-1 ring-inset ring-white/10">
              <div className="font-display text-2xl font-semibold">That's a wrap for today</div>
              <div className="mt-1 text-forest-100">{r.hoursWorked !== null && `${hours(r.hoursWorked)} worked. `}Thank you!</div>
            </div>
          )}

          {askLateReason && (
            <form action={lateReason} className="mt-4 flex gap-2">
              <input
                name="reason"
                placeholder="Running late? Tell your manager why (optional)"
                className="h-12 flex-1 rounded-xl bg-white/10 px-4 text-white placeholder:text-forest-200 outline-none ring-1 ring-inset ring-white/15 focus:ring-gold-400"
              />
              <FormButton variant="gold" className="h-12">Send</FormButton>
            </form>
          )}
        </div>
      </section>

      {/* Tasks sheet */}
      <section className="relative -mt-8 rounded-t-[32px] bg-canvas px-6 pb-12 pt-8 sm:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-semibold">My tasks today</h2>
              <p className="text-sm text-muted">{tasks.length ? `${tasksDone} of ${tasks.length} done` : "Nothing assigned for today."}</p>
            </div>
            {tasks.length > 0 && (
              <Ring value={tasksDone} max={tasks.length} size={64} stroke={7} track="stroke-sunken" bar="stroke-forest-500">
                <span className="text-sm font-bold tabular-nums">{Math.round((tasksDone / tasks.length) * 100)}%</span>
              </Ring>
            )}
          </div>

          <div className="space-y-3">
            {tasks.map((t) => {
              const doneCount = t.subtasks.filter((s) => s.status === "completed").length;
              return (
                <div key={t.id} className={cx("rounded-2xl border bg-surface p-5 shadow-card", t.status === "completed" ? "border-forest-200" : "border-line")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-bold">{t.title}</div>
                      {t.description && <div className="text-sm text-ink-2">{t.description}</div>}
                    </div>
                    <TaskBadge status={t.status} />
                  </div>
                  {t.subtasks.length > 0 ? (
                    <>
                      <div className="mt-3 flex items-center gap-3">
                        <Progress value={doneCount} max={t.subtasks.length} />
                        <span className="text-xs font-semibold tabular-nums text-muted">{doneCount}/{t.subtasks.length}</span>
                      </div>
                      <ul className="mt-3 space-y-1">
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
                  ) : (
                    t.status !== "completed" && (
                      <form action={updateTask} className="mt-4">
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="status" value="completed" />
                        <FormButton variant="primary" pendingLabel="Saving…" className="h-12 px-6">
                          <Check className="h-4 w-4" /> Mark done
                        </FormButton>
                      </form>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

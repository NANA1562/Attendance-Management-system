import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobRoles } from "@/db/schema";
import { FormButton, TickButton } from "@/components/form-button";
import { Pill, StatusBadge, TaskBadge } from "@/components/ui";
import { allowedActions, type EventType } from "@/lib/attendance/engine";
import { clock, duration, hours, STATUS_LABEL } from "@/lib/format";
import { employeeToday } from "@/server/attendance";
import { requireStaff } from "@/server/auth";
import { ensureForDay, listTasks } from "@/server/tasks";
import { doneOnTablet, lateReason, tap, toggleSubtask, updateTask } from "../actions";
import { IdleReturn } from "./idle-return";

const ACTION: Record<EventType, { label: string; variant: "green" | "amber" | "red" | "primary" }> = {
  clock_in: { label: "Clock in", variant: "green" },
  break_start: { label: "Start break", variant: "amber" },
  break_end: { label: "End break", variant: "green" },
  clock_out: { label: "Clock out", variant: "red" },
};

const DONE_MESSAGE: Record<EventType, string> = {
  clock_in: "Clocked in",
  break_start: "Break started",
  break_end: "Break ended — welcome back",
  clock_out: "Clocked out — see you next time",
};

export default async function KioskMePage({ searchParams }: PageProps<"/kiosk/me">) {
  const { employee, settings } = await requireStaff();
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

  const shift =
    day.plan.kind === "working"
      ? `${day.plan.start} – ${day.plan.end}${day.plan.halfDay ? " (half day)" : ""}`
      : day.plan.kind === "leave"
        ? "On leave today"
        : "Off today";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-8">
      <IdleReturn seconds={done === "clock_out" ? 10 : 45} />

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Hi, {employee.fullName.split(" ")[0]}</h1>
          <div className="mt-1 text-stone-600">
            {role?.name ?? (employee.level === "senior" ? "Senior" : "Staff")} · Today: {shift}
          </div>
        </div>
        <form action={doneOnTablet}>
          <FormButton variant="secondary" className="px-5 py-3 text-base">Done</FormButton>
        </form>
      </header>

      {done && DONE_MESSAGE[done] && (
        <div className="rounded-xl bg-emerald-50 px-5 py-4 text-lg font-medium text-emerald-800">
          ✓ {DONE_MESSAGE[done]}
          {done === "clock_in" && r.status !== "not_in_yet" && ` at ${clock(r.clockInAt, tz)} — ${STATUS_LABEL[r.status]}`}
          {done === "clock_out" && r.hoursWorked !== null && ` — ${hours(r.hoursWorked)} worked`}
        </div>
      )}
      {error && <div className="rounded-xl bg-red-50 px-5 py-4 text-red-700">{error}</div>}

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={r.status} />
          {r.state === "on_break" && <Pill tone="bg-amber-100 text-amber-800">On break</Pill>}
          {r.minutesLate > 0 && <span className="text-sm text-stone-600">{duration(r.minutesLate)} late</span>}
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div><dt className="text-xs uppercase text-stone-500">Clocked in</dt><dd className="text-xl font-semibold tabular-nums">{clock(r.clockInAt, tz)}</dd></div>
          <div><dt className="text-xs uppercase text-stone-500">Break</dt><dd className="text-xl font-semibold tabular-nums">{duration(r.breakMinutes)}</dd></div>
          <div><dt className="text-xs uppercase text-stone-500">Clocked out</dt><dd className="text-xl font-semibold tabular-nums">{clock(r.clockOutAt, tz)}</dd></div>
        </dl>

        {actions.length > 0 ? (
          <div className={`mt-6 grid gap-3 ${actions.length > 1 ? "grid-cols-2" : ""}`}>
            {actions.map((a) => (
              <form key={a} action={tap}>
                <input type="hidden" name="type" value={a} />
                <FormButton variant={ACTION[a].variant} pendingLabel="Saving…" className="h-20 w-full rounded-2xl text-2xl">{ACTION[a].label}</FormButton>
              </form>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-center text-stone-600">
            You've clocked out for today{r.hoursWorked !== null && ` · ${hours(r.hoursWorked)} worked`}.
          </p>
        )}

        {askLateReason && (
          <form action={lateReason} className="mt-5 flex gap-2">
            <input
              name="reason"
              placeholder="Reason for being late (optional)"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2"
            />
            <FormButton variant="secondary">Save</FormButton>
          </form>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">My tasks today</h2>
        {tasks.length === 0 && <p className="text-stone-500">No tasks for today.</p>}
        <div className="space-y-3">
          {tasks.map((t) => {
            const doneCount = t.subtasks.filter((s) => s.status === "completed").length;
            return (
              <div key={t.id} className="rounded-2xl border border-stone-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{t.title}</div>
                    {t.description && <div className="text-sm text-stone-600">{t.description}</div>}
                  </div>
                  <TaskBadge status={t.status} />
                </div>
                {t.subtasks.length > 0 ? (
                  <>
                    <div className="mt-1 text-xs text-stone-500">{doneCount}/{t.subtasks.length} done</div>
                    <ul className="mt-3 space-y-2">
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
                    <form action={updateTask} className="mt-3">
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="status" value="completed" />
                      <FormButton variant="green" pendingLabel="Saving…">Mark done</FormButton>
                    </form>
                  )
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}


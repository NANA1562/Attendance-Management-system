import { eq } from "drizzle-orm";
import type { ReactNode } from "react";
import {
  BadgeCheck,
  CalendarClock,
  Check,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Coffee,
  Hash,
  Info,
  LogIn,
  LogOut,
  Play,
  ShieldCheck,
  Tags,
  Timer,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { db } from "@/db";
import { jobRoles } from "@/db/schema";
import { Mark } from "@/components/brand";
import { FormButton, TickButton } from "@/components/form-button";
import { Avatar, cx, Progress, StatusBadge, TaskBadge } from "@/components/ui";
import { allowedActions, type EventType } from "@/lib/attendance/engine";
import { clock, duration, hours, STATUS_LABEL } from "@/lib/format";
import { localTime } from "@/lib/time";
import { employeeToday } from "@/server/attendance";
import { requireStaff } from "@/server/auth";
import { ensureForDay, listTasks } from "@/server/tasks";
import { Clock } from "../clock";
import { doneOnTablet, lateReason, tap, toggleSubtask, updateTask } from "../actions";
import { IdleReturn } from "./idle-return";

const ACTION: Record<EventType, { label: string; variant: "green" | "amber" | "red"; icon: LucideIcon }> = {
  clock_in: { label: "Clock in", variant: "green", icon: LogIn },
  break_start: { label: "Start break", variant: "amber", icon: Coffee },
  break_end: { label: "End break", variant: "green", icon: Play },
  clock_out: { label: "Clock out", variant: "red", icon: LogOut },
};

const DONE_MESSAGE: Record<EventType, string> = {
  clock_in: "You're clocked in",
  break_start: "Your break has started",
  break_end: "Welcome back, break ended",
  clock_out: "You're clocked out. See you next time",
};

function greeting(timeZone: string) {
  const h = Number(localTime(new Date(), timeZone).slice(0, 2));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

type StepState = "done" | "active" | "pending" | "skipped";

/** A workflow-style step: mono label row on a soft rim, white body inside. */
function Step({
  index,
  label,
  tag,
  state,
  icon: Icon,
  title,
  description,
  children,
}: {
  index: number;
  label: string;
  tag: string;
  state: StepState;
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      className={cx(
        "rounded-[18px] border p-[3px] transition",
        state === "active" ? "border-accent-200 bg-accent-50 shadow-pop ring-4 ring-accent-100/60" : "border-line bg-subtle",
        state === "pending" && "opacity-70",
      )}
    >
      <div className="flex items-center justify-between px-3.5 pb-2 pt-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
        <span>
          Step {index} · {label}
        </span>
        <span className={cx(state === "done" && "text-ok", state === "active" && "text-accent-700")}>{tag}</span>
      </div>
      <div className="rounded-[15px] border border-line bg-surface p-4 shadow-card">
        <div className="flex items-start gap-3">
          <span
            className={cx(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border",
              state === "done" ? "border-green-200 bg-green-50 text-ok" : state === "active" ? "border-accent-200 bg-accent-50 text-accent-700" : "border-line-strong bg-subtle text-muted",
            )}
          >
            {state === "done" ? <Check className="h-[18px] w-[18px]" strokeWidth={2.5} /> : <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-semibold text-ink">{title}</div>
            <div className="mt-0.5 text-[13px] text-muted">{description}</div>
          </div>
        </div>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </section>
  );
}

/** Connector between steps: dot, line, arrow head. */
function Connector() {
  return (
    <div className="flex flex-col items-center" aria-hidden>
      <span className="h-2.5 w-2.5 rounded-full border-2 border-accent-400 bg-surface" />
      <span className="h-6 w-px bg-line-strong" />
      <span className="h-0 w-0 border-x-[4px] border-t-[5px] border-x-transparent border-t-line-strong" />
    </div>
  );
}

function TapButton({ type }: { type: EventType }) {
  const { label, variant, icon: Icon } = ACTION[type];
  return (
    <form action={tap} className="flex-1">
      <input type="hidden" name="type" value={type} />
      <FormButton variant={variant} pendingLabel="Saving…" className="h-14 w-full rounded-[14px] text-[16px] font-semibold">
        <Icon className="h-5 w-5" /> {label}
      </FormButton>
    </form>
  );
}

function DetailRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center py-2 text-[13px]">
      <dt className="flex items-center gap-2 text-muted"><Icon className="h-4 w-4" strokeWidth={1.75} /> {label}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  );
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
  const plan = day.plan.kind === "working" ? day.plan : null;
  const breaks = r.segments.filter((s) => s.kind === "break");
  const openBreak = breaks.find((b) => b.open);
  const breakTotal = r.breakMinutes ? duration(r.breakMinutes) : "under 1m";

  const shift = plan
    ? `${plan.start} – ${plan.end}${plan.halfDay ? " · half day" : ""}`
    : day.plan.kind === "leave"
      ? "On leave today"
      : "Day off";

  // Step states
  const inState: StepState = r.clockInAt ? "done" : "active";
  const breakState: StepState =
    r.state === "on_break" ? "active" : r.clockOutAt ? (breaks.length ? "done" : "skipped") : r.clockInAt ? (breaks.length ? "done" : "active") : "pending";
  const outState: StepState = r.clockOutAt ? "done" : r.state === "working" ? "active" : "pending";

  return (
    <main className="min-h-screen bg-canvas p-0 sm:p-2.5">
      <IdleReturn seconds={done === "clock_out" ? 10 : 45} />
      <div className="flex min-h-screen flex-col overflow-hidden bg-surface sm:min-h-[calc(100vh-20px)] sm:rounded-[20px] sm:border sm:border-line sm:shadow-card">
        {/* Header with breadcrumb */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5 font-mono text-[12px] uppercase tracking-[0.12em] text-muted">
            <Mark className="h-6 w-6 shrink-0" />
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-faint" />
            <span className="hidden truncate sm:inline">{business.name}</span>
            <span className="hidden text-faint sm:inline">/</span>
            <span className="truncate text-ink">{employee.fullName}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden md:block"><Clock timeZone={tz} /></span>
            <form action={doneOnTablet}>
              <FormButton variant="primary" className="h-9 px-4">
                <Check className="h-4 w-4" /> Done
              </FormButton>
            </form>
          </div>
        </header>

        {/* Sub header: tabs-style row */}
        <div className="flex shrink-0 items-center gap-6 border-b border-line px-4 text-[14px] sm:px-5">
          <span className="-mb-px flex items-center gap-2 border-b-2 border-ink py-3 font-medium text-ink"><Timer className="h-4 w-4" strokeWidth={1.75} /> My day</span>
          <a href="#checklist" className="flex items-center gap-2 py-3 text-muted hover:text-ink"><ClipboardCheck className="h-4 w-4" strokeWidth={1.75} /> Checklist <span className="rounded-full border border-line-strong px-1.5 text-xs">{tasksDone}/{tasks.length}</span></a>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Canvas */}
          <div className="dot-grid min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <div className="mx-auto max-w-lg">
              {/* Info bar */}
              {(done && DONE_MESSAGE[done]) || error ? (
                <div className={cx("mb-6 flex animate-fade-up items-center gap-3 rounded-[16px] border bg-surface p-3 pr-4 shadow-pop", error ? "border-red-200" : "border-line")}>
                  <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border", error ? "border-red-200 bg-red-50 text-absent" : "border-green-200 bg-green-50 text-ok")}>
                    {error ? <CircleAlert className="h-5 w-5" /> : <Check className="h-5 w-5 animate-pop" strokeWidth={2.5} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold">{error ?? DONE_MESSAGE[done!]}</div>
                    {!error && (
                      <div className="text-[13px] text-muted">
                        {done === "clock_in" && r.status !== "not_in_yet" && `${clock(r.clockInAt, tz)} · ${STATUS_LABEL[r.status]}`}
                        {done === "clock_out" && r.hoursWorked !== null && `${hours(r.hoursWorked)} worked today. Tap Done when you're finished.`}
                        {(done === "break_start" || done === "break_end") && `Recorded at ${localTime(new Date(), tz)}`}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mb-6 flex items-center gap-3 rounded-[16px] border border-line bg-surface p-3 pr-4 shadow-card">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border border-sky-200 bg-sky-50 text-leave"><Info className="h-5 w-5" /></span>
                  <div className="text-[14px]">
                    <span className="font-semibold">{greeting(tz)}, {employee.fullName.split(" ")[0]}.</span>{" "}
                    <span className="text-muted">{actions.length ? "Your next step is highlighted below." : "You're all done for today."}</span>
                  </div>
                </div>
              )}

              {/* Flow */}
              <Step
                index={1}
                label="Clock in"
                tag={r.clockInAt ? STATUS_LABEL[r.status] : plan ? `Starts ${plan.start}` : "Unscheduled"}
                state={inState}
                icon={LogIn}
                title={r.clockInAt ? `Clocked in at ${clock(r.clockInAt, tz)}` : "Clock in to start your day"}
                description={
                  r.clockInAt
                    ? r.minutesLate > 0
                      ? `${duration(r.minutesLate)} after your ${plan?.start ?? ""} start`
                      : "Right on time. Nice work."
                    : plan
                      ? `Your shift today is ${shift}.`
                      : day.plan.kind === "leave"
                        ? "You're on leave today. Clocking in records extra work."
                        : "You're not scheduled today. Clocking in counts as working on an off day."
                }
              >
                {actions.includes("clock_in") && <TapButton type="clock_in" />}
                {askLateReason && (
                  <form action={lateReason} className="flex gap-2">
                    <input
                      name="reason"
                      placeholder="Running late? Tell your manager why (optional)"
                      className="h-11 min-w-0 flex-1 rounded-[12px] border border-line-strong bg-surface px-3.5 text-[14px] shadow-card outline-none placeholder:text-faint focus:border-accent-400 focus:ring-4 focus:ring-accent-100"
                    />
                    <FormButton variant="primary" className="h-11 px-5">Send</FormButton>
                  </form>
                )}
                {day.lateReason && <div className="rounded-[10px] bg-subtle px-3 py-2 text-[13px] italic text-ink-2">“{day.lateReason}”</div>}
              </Step>

              <Connector />

              <Step
                index={2}
                label="Break"
                tag={openBreak ? "Running" : breaks.length ? breakTotal : r.clockOutAt ? "Skipped" : `${r.breakAllowanceMinutes || 0}m allowed`}
                state={breakState}
                icon={Coffee}
                title={openBreak ? "On break" : breaks.length ? `Break taken · ${breakTotal}` : "Take your break"}
                description={
                  openBreak
                    ? `Started at ${localTime(openBreak.from, tz)}. Tap End break when you're back.`
                    : breaks.length
                      ? `${breaks.length} break${breaks.length === 1 ? "" : "s"} today, last ended ${localTime(breaks.at(-1)!.to, tz)}`
                      : r.breakAllowanceMinutes
                        ? `Your allowance is ${r.breakAllowanceMinutes} minutes.`
                        : "Pause the clock whenever you step away."
                }
              >
                {(actions.includes("break_start") || actions.includes("break_end")) && (
                  <TapButton type={actions.includes("break_end") ? "break_end" : "break_start"} />
                )}
              </Step>

              <Connector />

              <Step
                index={3}
                label="Clock out"
                tag={r.clockOutAt ? "Done" : plan ? `Ends ${plan.end}` : "Pending"}
                state={outState}
                icon={LogOut}
                title={r.clockOutAt ? `Clocked out at ${clock(r.clockOutAt, tz)}` : "Clock out when you finish"}
                description={
                  r.clockOutAt
                    ? `${hours(r.hoursWorked)} worked${r.overtimeMinutes ? ` · ${duration(r.overtimeMinutes)} overtime` : ""}${r.earlyLeaveMinutes ? ` · left ${duration(r.earlyLeaveMinutes)} early` : ""}`
                    : plan
                      ? `Your shift ends at ${plan.end}.`
                      : "Tap when you leave."
                }
              >
                {actions.includes("clock_out") && <TapButton type="clock_out" />}
              </Step>
            </div>
          </div>

          {/* Side panel */}
          <aside className="shrink-0 border-t border-line bg-surface lg:w-[380px] lg:overflow-y-auto lg:border-l lg:border-t-0">
            <div className="border-b border-line p-5">
              <div className="flex items-center gap-2 text-[14px] font-semibold"><UserRound className="h-4 w-4 text-muted" strokeWidth={1.75} /> Details</div>
              <div className="mt-4 flex items-center gap-3">
                <Avatar name={employee.fullName} size="lg" />
                <div>
                  <div className="text-[16px] font-semibold">{employee.fullName}</div>
                  <div className="text-[13px] text-muted">{role?.name ?? (employee.level === "senior" ? "Senior" : "Staff")}</div>
                </div>
              </div>
              <dl className="mt-3 divide-y divide-line">
                <DetailRow icon={Hash} label="Staff ID"><span className="rounded-md border border-line-strong bg-subtle px-1.5 py-0.5 font-mono text-xs">{employee.staffCode}</span></DetailRow>
                <DetailRow icon={Tags} label="Role">{role?.name ?? <span className="text-faint">—</span>}</DetailRow>
                <DetailRow icon={CalendarClock} label="Shift"><span className="font-mono">{shift}</span></DetailRow>
                <DetailRow icon={BadgeCheck} label="Status">{r.clockInAt ? <StatusBadge status={r.status} /> : <span className="text-faint">Not clocked in</span>}</DetailRow>
                <DetailRow icon={Clock3} label="Worked">{r.hoursWorked !== null ? hours(r.hoursWorked) : r.clockInAt ? "In progress" : "—"}</DetailRow>
              </dl>
            </div>

            <div id="checklist" className="scroll-mt-4 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[14px] font-semibold"><ClipboardCheck className="h-4 w-4 text-muted" strokeWidth={1.75} /> Checklist</div>
                <span className="font-mono text-xs text-muted">{tasksDone}/{tasks.length} done</span>
              </div>
              <p className="mt-1 text-[13px] text-muted">{tasks.length ? "Tick things off as you go." : "Nothing assigned for today."}</p>
              {tasks.length > 0 && <Progress value={tasksDone} max={tasks.length} className="mt-3" />}

              <div className="mt-4 space-y-2.5">
                {tasks.map((t) => {
                  const doneCount = t.subtasks.filter((s) => s.status === "completed").length;
                  return (
                    <article key={t.id} className="overflow-hidden rounded-[14px] border border-line">
                      <header className="flex items-center justify-between gap-3 border-b border-line bg-subtle px-3.5 py-2.5">
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-medium">{t.title}</div>
                          {t.subtasks.length > 0 && <div className="font-mono text-[11px] text-muted">{doneCount}/{t.subtasks.length} steps</div>}
                        </div>
                        <TaskBadge status={t.status} />
                      </header>
                      <div className="px-2 py-1.5">
                        {t.subtasks.length > 0 ? (
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
                        ) : t.status !== "completed" ? (
                          <form action={updateTask} className="p-1.5">
                            <input type="hidden" name="id" value={t.id} />
                            <input type="hidden" name="status" value="completed" />
                            <FormButton variant="secondary" pendingLabel="Saving…" className="h-10 w-full">
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

              <div className="mt-6 flex items-center gap-1.5 text-xs text-faint"><ShieldCheck className="h-3.5 w-3.5" /> Tap Done when you're finished so the next person can clock in.</div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

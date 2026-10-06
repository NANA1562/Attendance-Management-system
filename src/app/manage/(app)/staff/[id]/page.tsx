import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { ArrowLeft, CalendarRange, KeyRound, Lock, Palmtree, UserRound } from "lucide-react";
import { z } from "zod";
import { db } from "@/db";
import { employees, jobRoles, leave, schedules } from "@/db/schema";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { FormButton } from "@/components/form-button";
import { Avatar, Card, cx, Empty, Field, Input, Pill, Select, StatusBadge, Table, Td, Th } from "@/components/ui";
import { clock, DAY_NAMES, duration, hours, prettyDate } from "@/lib/format";
import { addDays } from "@/lib/time";
import { employeeDays, today } from "@/server/attendance";
import { requireManager } from "@/server/auth";
import { addLeave, cancelLeave, resetPin, saveSchedule, setPassword, unlockStaff, updateStaff } from "../../../actions";

const LEAVE_TYPE = { annual: "Annual", sick: "Sick", permission: "Permission", other: "Other" };
const DAY_PART = { full_day: "Full day", morning_off: "Morning off", afternoon_off: "Afternoon off" };
// Show Monday first.
const WEEK = [1, 2, 3, 4, 5, 6, 0];

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { business, settings } = await requireManager();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.businessId, business.id)));
  if (!employee) notFound();

  const now = today(settings);
  const [roles, weekly, leaves, history] = await Promise.all([
    db.select().from(jobRoles).where(eq(jobRoles.businessId, business.id)).orderBy(asc(jobRoles.name)),
    db.select().from(schedules).where(eq(schedules.employeeId, employee.id)),
    db.select().from(leave).where(eq(leave.employeeId, employee.id)).orderBy(desc(leave.startDate)),
    employeeDays(employee, settings, addDays(now, -13), now),
  ]);
  const tz = settings.timezone;
  const locked = employee.lockedUntil && employee.lockedUntil > new Date();
  const role = roles.find((r) => r.id === employee.roleId);

  // 14-day summary
  const worked = history.filter((d) => d.result.clockInAt);
  const lateDays = history.filter((d) => d.result.status === "late" || d.result.status === "attendance_risk").length;
  const absentDays = history.filter((d) => d.result.status === "absent").length;
  const totalMinutes = Math.round(worked.reduce((s, d) => s + (d.result.hoursWorked ?? 0), 0) * 60);
  const overtime = history.reduce((s, d) => s + d.result.overtimeMinutes, 0);
  const weeklyMinutes = WEEK.reduce((s, d) => {
    const row = weekly.find((w) => w.dayOfWeek === d);
    if (!row || row.isDayOff || !row.startTime || !row.endTime) return s;
    const [sh, sm] = row.startTime.split(":").map(Number);
    const [eh, em] = row.endTime.split(":").map(Number);
    return s + (eh * 60 + em - (sh * 60 + sm)) - row.breakMinutes;
  }, 0);

  return (
    <div className="space-y-6">
      <Link href="/manage/staff" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> All staff</Link>

      {/* Profile header */}
      <section className="overflow-hidden rounded-[18px] border border-line bg-subtle p-[3px]">
        <div className="overflow-hidden rounded-[15px] border border-line bg-surface shadow-card">
        <div className="dot-grid h-20 border-b border-line bg-subtle" />
        <div className="flex flex-wrap items-end gap-5 px-6 pb-6">
          <Avatar name={employee.fullName} size="xl" className="-mt-8 ring-4 ring-surface" />
          <div className="min-w-0 flex-1 pt-3">
            <h1 className="text-[22px] font-semibold tracking-tight">{employee.fullName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-line-strong bg-subtle px-1.5 py-0.5 font-mono text-xs">ID {employee.staffCode}</span>
              {employee.level === "senior" ? <Pill tone="bg-accent-50 text-accent-700 ring-accent-200/70">Senior</Pill> : <Pill>Junior</Pill>}
              {role && <Pill>{role.name}</Pill>}
              {employee.status === "inactive" && <Pill>Inactive</Pill>}
              {locked && <Pill tone="bg-red-50 text-red-700 ring-red-200/70"><Lock className="h-3 w-3" /> Locked out</Pill>}
            </div>
          </div>
          <dl className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 lg:w-auto">
            {[
              ["Days worked", String(worked.length), "last 14 days"],
              ["Late", String(lateDays), absentDays ? `${absentDays} absent` : "no absences"],
              ["Hours", duration(totalMinutes) || "0m", "last 14 days"],
              ["Overtime", duration(overtime) || "0m", "last 14 days"],
            ].map(([label, value, sub]) => (
              <div key={label} className="rounded-[12px] border border-line bg-subtle px-4 py-3">
                <dt className="text-xs font-semibold text-muted">{label}</dt>
                <dd className="text-[22px] font-semibold tracking-tight tabular-nums">{value}</dd>
                <dd className="text-[11px] text-muted">{sub}</dd>
              </div>
            ))}
          </dl>
        </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><UserRound className="h-4 w-4 text-muted" /> Details</span>}>
          <ActionForm action={updateStaff} className="space-y-4">
            <input type="hidden" name="employeeId" value={employee.id} />
            <Field label="Full name"><Input name="fullName" defaultValue={employee.fullName} required /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Level">
                <Select name="level" defaultValue={employee.level}>
                  <option value="junior">Junior</option>
                  <option value="senior">Senior</option>
                </Select>
              </Field>
              <Field label="Status">
                <Select name="status" defaultValue={employee.status}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </Field>
            </div>
            <Field label="Role">
              <Select name="roleId" defaultValue={employee.roleId ?? ""}>
                <option value="">No role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id} disabled={r.status === "inactive" && r.id !== employee.roleId}>
                    {r.name}{r.status === "inactive" ? " (disabled)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Phone"><Input name="phone" type="tel" defaultValue={employee.phone ?? ""} /></Field>
            <SubmitButton>Save details</SubmitButton>
          </ActionForm>
        </Card>

        <Card title={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-muted" /> Access</span>}>
          <div className="space-y-5">
            <ActionForm action={resetPin}>
              <input type="hidden" name="employeeId" value={employee.id} />
              <div className="flex items-center justify-between gap-4 rounded-[12px] border border-line bg-subtle p-4">
                <div>
                  <div className="text-sm font-semibold">Clock-in PIN</div>
                  <p className="text-xs text-muted">Stored securely and never shown. Reset to issue a new one.</p>
                </div>
                <SubmitButton variant="secondary" pendingLabel="Resetting…">Reset PIN</SubmitButton>
              </div>
            </ActionForm>

            <ActionForm action={setPassword} className="space-y-2" resetOnSuccess>
              <input type="hidden" name="employeeId" value={employee.id} />
              <Field
                label="Dashboard password"
                hint={employee.passwordHash ? "Set a new password to replace the current one." : "Needed before this person can be made senior."}
              >
                <div className="flex gap-2">
                  <Input name="password" type="password" minLength={8} required placeholder="At least 8 characters" />
                  <SubmitButton variant="secondary">Set</SubmitButton>
                </div>
              </Field>
            </ActionForm>

            {locked && (
              <form action={unlockStaff} className="flex items-center justify-between gap-4 rounded-[12px] bg-red-50 p-4 ring-1 ring-inset ring-red-200/70">
                <input type="hidden" name="employeeId" value={employee.id} />
                <p className="text-sm font-semibold text-absent">Locked after too many wrong PINs.</p>
                <FormButton variant="danger">Unlock now</FormButton>
              </form>
            )}
          </div>
        </Card>
      </div>

      <Card
        title={<span className="flex items-center gap-2"><CalendarRange className="h-4 w-4 text-muted" /> Weekly schedule</span>}
        description={`${duration(weeklyMinutes) || "0m"} expected per week after breaks. Unticked days are days off.`}
      >
        <ActionForm action={saveSchedule}>
          <input type="hidden" name="employeeId" value={employee.id} />
          <div className="grid gap-2">
            {WEEK.map((d) => {
              const row = weekly.find((s) => s.dayOfWeek === d);
              const working = !!row && !row.isDayOff;
              return (
                <div key={d} className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-[12px] border border-line px-4 py-2.5 has-[:checked]:bg-surface bg-subtle/60 sm:grid-cols-[160px_1fr_1fr_120px] sm:gap-4">
                  <label className="flex items-center gap-3 font-semibold">
                    <input type="checkbox" name={`work_${d}`} defaultChecked={working} className="h-5 w-5 accent-[var(--color-ink)]" />
                    {DAY_NAMES[d]}
                  </label>
                  <div className="col-span-2 grid grid-cols-3 gap-2 sm:contents">
                    <Input type="time" name={`start_${d}`} defaultValue={row?.startTime?.slice(0, 5) ?? "08:00"} aria-label={`${DAY_NAMES[d]} start`} />
                    <Input type="time" name={`end_${d}`} defaultValue={row?.endTime?.slice(0, 5) ?? "17:00"} aria-label={`${DAY_NAMES[d]} end`} />
                    <div className="relative">
                      <Input type="number" name={`break_${d}`} min={0} max={240} defaultValue={working ? row!.breakMinutes : settings.defaultBreakMinutes} aria-label={`${DAY_NAMES[d]} break minutes`} className="pr-12" />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">min</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">Start, end and break allowance per day. Once someone has worked half their shift, the allowance is deducted; a longer break deducts the real time.</p>
          <SubmitButton className="mt-4">Save schedule</SubmitButton>
        </ActionForm>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><Palmtree className="h-4 w-4 text-muted" /> Record leave</span>}>
          <ActionForm action={addLeave} className="space-y-4" resetOnSuccess>
            <input type="hidden" name="employeeId" value={employee.id} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <Select name="leaveType" defaultValue="annual">
                  {Object.entries(LEAVE_TYPE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </Field>
              <Field label="Length">
                <Select name="dayPart" defaultValue="full_day">
                  {Object.entries(DAY_PART).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </Field>
              <Field label="From"><Input type="date" name="startDate" defaultValue={now} required /></Field>
              <Field label="To" hint="Ignored for half days."><Input type="date" name="endDate" /></Field>
            </div>
            <Field label="Reason (optional)"><Input name="reason" /></Field>
            <SubmitButton>Record leave</SubmitButton>
          </ActionForm>
        </Card>

        <Card title="Leave history">
          {leaves.length === 0 ? (
            <Empty icon={Palmtree} title="No leave recorded" />
          ) : (
            <ul className="space-y-2">
              {leaves.map((l) => (
                <li key={l.id} className={cx("flex items-center justify-between gap-3 rounded-[12px] border border-line p-3", l.status === "cancelled" && "opacity-50")}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-line-strong bg-surface text-leave shadow-card"><Palmtree className="h-4 w-4" /></span>
                    <div>
                      <div className={cx("text-sm font-semibold", l.status === "cancelled" && "line-through")}>
                        {prettyDate(l.startDate)}{l.endDate !== l.startDate && ` – ${prettyDate(l.endDate)}`}
                      </div>
                      <div className="text-xs text-muted">
                        {LEAVE_TYPE[l.leaveType]} · {DAY_PART[l.dayPart]}{l.reason && ` · ${l.reason}`}{l.status === "cancelled" && " · cancelled"}
                      </div>
                    </div>
                  </div>
                  {l.status === "active" && l.endDate >= now && (
                    <form action={cancelLeave}>
                      <input type="hidden" name="leaveId" value={l.id} />
                      <FormButton variant="ghost" className="px-3 py-1.5 text-xs text-absent">Cancel</FormButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Last 14 days" description="Worked out live from the schedule, leave and clock-ins." flush>
        {history.length === 0 ? (
          <div className="px-5 pb-5"><Empty title="No history yet" /></div>
        ) : (
          <Table minWidth={760}>
            <thead>
              <tr><Th>Date</Th><Th>Status</Th><Th>Shift</Th><Th>In</Th><Th>Out</Th><Th>Break</Th><Th>Hours</Th><Th>Over / under</Th></tr>
            </thead>
            <tbody>
              {history.map(({ workDate, plan, result: r }) => (
                <tr key={workDate} className="hover:bg-subtle">
                  <Td><Link href={`/manage?date=${workDate}`} className="font-semibold hover:underline">{prettyDate(workDate)}</Link></Td>
                  <Td>
                    <div className="flex flex-wrap items-center gap-1">
                      <StatusBadge status={r.status} />
                      {r.missingClockOut && <Pill tone="bg-red-50 text-red-700 ring-red-200/70">No clock-out</Pill>}
                    </div>
                  </Td>
                  <Td className="tabular-nums text-ink-2">{plan.kind === "working" ? `${plan.start}–${plan.end}` : "—"}</Td>
                  <Td className="font-mono tabular-nums">{clock(r.clockInAt, tz)}</Td>
                  <Td className="font-mono tabular-nums">{clock(r.clockOutAt, tz)}</Td>
                  <Td className="tabular-nums text-ink-2">{duration(r.breakMinutes)}</Td>
                  <Td className="tabular-nums font-semibold">{hours(r.hoursWorked)}</Td>
                  <Td className="tabular-nums">
                    {r.overtimeMinutes ? <span className="text-ok">+{duration(r.overtimeMinutes)}</span> : r.undertimeMinutes ? <span className="text-late">−{duration(r.undertimeMinutes)}</span> : <span className="text-muted">—</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

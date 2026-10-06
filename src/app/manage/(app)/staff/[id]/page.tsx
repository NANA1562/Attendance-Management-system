import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { employees, jobRoles, leave, schedules } from "@/db/schema";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button, Card, Field, Input, Pill, Select, StatusBadge } from "@/components/ui";
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

  return (
    <div className="space-y-6">
      <div>
        <Link href="/manage/staff" className="text-sm text-stone-500">← Staff</Link>
        <h1 className="mt-2 text-2xl font-semibold">{employee.fullName}</h1>
        <div className="mt-1 flex items-center gap-2 text-sm text-stone-600">
          Staff ID <span className="font-mono font-semibold">{employee.staffCode}</span>
          <span className="capitalize">· {employee.level}</span>
          {employee.status === "inactive" && <Pill>Inactive</Pill>}
          {locked && <Pill tone="bg-red-100 text-red-800">Locked out</Pill>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Details">
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

        <Card title="Access">
          <div className="space-y-5">
            <ActionForm action={resetPin}>
              <input type="hidden" name="employeeId" value={employee.id} />
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-stone-600">PINs are stored securely and can't be viewed. Reset to give them a new one.</p>
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
              <form action={unlockStaff} className="flex items-center justify-between gap-4">
                <input type="hidden" name="employeeId" value={employee.id} />
                <p className="text-sm text-red-700">Locked after too many wrong attempts.</p>
                <Button variant="danger">Unlock now</Button>
              </form>
            )}
          </div>
        </Card>
      </div>

      <Card title="Weekly schedule">
        <ActionForm action={saveSchedule}>
          <input type="hidden" name="employeeId" value={employee.id} />
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs uppercase text-stone-500">
                <tr className="border-b border-stone-200">
                  <th className="px-5 py-2">Day</th>
                  <th className="px-2 py-2">Working</th>
                  <th className="px-2 py-2">Start</th>
                  <th className="px-2 py-2">End</th>
                  <th className="px-5 py-2">Break (min)</th>
                </tr>
              </thead>
              <tbody>
                {WEEK.map((d) => {
                  const row = weekly.find((s) => s.dayOfWeek === d);
                  const working = !!row && !row.isDayOff;
                  return (
                    <tr key={d} className="border-b border-stone-100 last:border-0">
                      <td className="px-5 py-2 font-medium">{DAY_NAMES[d]}</td>
                      <td className="px-2 py-2"><input type="checkbox" name={`work_${d}`} defaultChecked={working} className="h-5 w-5" /></td>
                      <td className="px-2 py-2"><Input type="time" name={`start_${d}`} defaultValue={row?.startTime?.slice(0, 5) ?? "08:00"} className="w-32" /></td>
                      <td className="px-2 py-2"><Input type="time" name={`end_${d}`} defaultValue={row?.endTime?.slice(0, 5) ?? "17:00"} className="w-32" /></td>
                      <td className="px-5 py-2">
                        <Input type="number" name={`break_${d}`} min={0} max={240} defaultValue={working ? row!.breakMinutes : settings.defaultBreakMinutes} className="w-24" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-stone-500">
            Unticked days are off days. The break allowance is deducted from hours worked; a longer break deducts the actual time.
          </p>
          <SubmitButton className="mt-3">Save schedule</SubmitButton>
        </ActionForm>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Record leave">
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

        <Card title="Leave">
          {leaves.length === 0 ? (
            <p className="text-sm text-stone-500">No leave recorded.</p>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {leaves.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className={l.status === "cancelled" ? "text-stone-400 line-through" : ""}>
                    <div className="font-medium">
                      {prettyDate(l.startDate)}{l.endDate !== l.startDate && ` – ${prettyDate(l.endDate)}`}
                    </div>
                    <div className="text-xs text-stone-500">
                      {LEAVE_TYPE[l.leaveType]} · {DAY_PART[l.dayPart]}{l.reason && ` · ${l.reason}`}
                    </div>
                  </div>
                  {l.status === "active" && l.endDate >= now && (
                    <form action={cancelLeave}>
                      <input type="hidden" name="leaveId" value={l.id} />
                      <Button variant="danger" className="px-3 py-1 text-xs">Cancel</Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Last 14 days">
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase text-stone-500">
              <tr className="border-b border-stone-200">
                <th className="px-5 py-2">Date</th>
                <th className="px-2 py-2">Shift</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">In</th>
                <th className="px-2 py-2">Out</th>
                <th className="px-2 py-2">Break</th>
                <th className="px-2 py-2">Hours</th>
                <th className="px-2 py-2">Overtime</th>
                <th className="px-5 py-2">Under</th>
              </tr>
            </thead>
            <tbody>
              {history.map(({ workDate, plan, result: r }) => (
                <tr key={workDate} className="border-b border-stone-100 last:border-0">
                  <td className="px-5 py-2">
                    <Link href={`/manage?date=${workDate}`} className="hover:underline">{prettyDate(workDate)}</Link>
                  </td>
                  <td className="px-2 py-2 tabular-nums text-stone-600">{plan.kind === "working" ? `${plan.start}–${plan.end}` : "—"}</td>
                  <td className="px-2 py-2">
                    <StatusBadge status={r.status} />
                    {r.missingClockOut && <Pill tone="ml-1 bg-red-100 text-red-800">No clock-out</Pill>}
                  </td>
                  <td className="px-2 py-2 tabular-nums">{clock(r.clockInAt, tz)}</td>
                  <td className="px-2 py-2 tabular-nums">{clock(r.clockOutAt, tz)}</td>
                  <td className="px-2 py-2 tabular-nums">{duration(r.breakMinutes)}</td>
                  <td className="px-2 py-2 tabular-nums">{hours(r.hoursWorked)}</td>
                  <td className="px-2 py-2 tabular-nums">{duration(r.overtimeMinutes)}</td>
                  <td className="px-5 py-2 tabular-nums">{duration(r.undertimeMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

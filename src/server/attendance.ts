import "server-only";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { attendance, attendanceEvents, employees, leave, schedules } from "@/db/schema";
import {
  allowedActions,
  computeDay,
  resolveDayPlan,
  tapState,
  type DayPlan,
  type DayResult,
  type EventType,
  type RuleSettings,
  type Tap,
} from "@/lib/attendance/engine";
import { addDays, localDate } from "@/lib/time";
import { audit } from "./audit";
import type { Employee, Settings } from "./auth";

export function rules(s: Settings): RuleSettings {
  return {
    graceMinutes: s.graceMinutes,
    lateUntilMinutes: s.lateUntilMinutes,
    absentAfterMinutes: s.absentAfterMinutes,
    timezone: s.timezone,
  };
}

export const today = (s: Settings) => localDate(new Date(), s.timezone);

export interface DayRow {
  employee: Employee;
  workDate: string;
  plan: DayPlan;
  result: DayResult;
  lateReason: string | null;
}

/** Schedules, leave and taps for some employees over a date range. */
async function loadRange(businessId: string, employeeIds: string[], from: string, to: string) {
  if (employeeIds.length === 0) return { scheds: [], leaves: [], atts: [], events: [] };
  const [scheds, leaves, atts, events] = await Promise.all([
    db.select().from(schedules).where(and(eq(schedules.businessId, businessId), inArray(schedules.employeeId, employeeIds))),
    db
      .select()
      .from(leave)
      .where(
        and(
          eq(leave.businessId, businessId),
          inArray(leave.employeeId, employeeIds),
          eq(leave.status, "active"),
          lte(leave.startDate, to),
          gte(leave.endDate, from),
        ),
      ),
    db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.businessId, businessId),
          inArray(attendance.employeeId, employeeIds),
          gte(attendance.workDate, from),
          lte(attendance.workDate, to),
        ),
      ),
    db
      .select({ attendanceId: attendanceEvents.attendanceId, eventType: attendanceEvents.eventType, eventAt: attendanceEvents.eventAt })
      .from(attendanceEvents)
      .innerJoin(attendance, eq(attendance.id, attendanceEvents.attendanceId))
      .where(
        and(
          eq(attendance.businessId, businessId),
          inArray(attendance.employeeId, employeeIds),
          gte(attendance.workDate, from),
          lte(attendance.workDate, to),
          eq(attendanceEvents.isVoided, false),
        ),
      )
      .orderBy(asc(attendanceEvents.eventAt)),
  ]);
  return { scheds, leaves, atts, events };
}

function buildRow(
  employee: Employee,
  workDate: string,
  data: Awaited<ReturnType<typeof loadRange>>,
  settings: Settings,
  now: Date,
): DayRow {
  const plan = resolveDayPlan(
    workDate,
    data.scheds.filter((s) => s.employeeId === employee.id),
    data.leaves.filter((l) => l.employeeId === employee.id),
  );
  const att = data.atts.find((a) => a.employeeId === employee.id && a.workDate === workDate);
  const taps: Tap[] = att ? data.events.filter((e) => e.attendanceId === att.id) : [];
  return {
    employee,
    workDate,
    plan,
    result: computeDay({ workDate, plan, taps, settings: rules(settings), now }),
    lateReason: att?.lateReason ?? null,
  };
}

/** The first local date an employee counts for (the day they were added). */
export const startDate = (e: Employee, s: Settings) => localDate(e.createdAt, s.timezone);

/** Every active employee's attendance for one date, worked out live. */
export async function dayOverview(businessId: string, settings: Settings, workDate: string) {
  const staff = (
    await db
      .select()
      .from(employees)
      .where(and(eq(employees.businessId, businessId), eq(employees.status, "active")))
      .orderBy(asc(employees.fullName))
  ).filter((e) => startDate(e, settings) <= workDate); // not yet hired → not listed
  const data = await loadRange(
    businessId,
    staff.map((e) => e.id),
    workDate,
    workDate,
  );
  const now = new Date();
  const rows = staff.map((e) => buildRow(e, workDate, data, settings, now));

  const count = (f: (r: DayRow) => boolean) => rows.filter(f).length;
  const counts = {
    staff: rows.length,
    scheduled: count((r) => r.plan.kind === "working"),
    present: count((r) => !!r.result.clockInAt),
    onTime: count((r) => r.result.status === "on_time" || r.result.status === "grace"),
    late: count((r) => r.result.status === "late" || r.result.status === "attendance_risk"),
    absent: count((r) => r.result.status === "absent"),
    notInYet: count((r) => r.result.status === "not_in_yet"),
    onLeave: count((r) => r.result.status === "on_leave"),
    off: count((r) => r.result.status === "off_day" || r.result.status === "worked_off_day"),
    onBreak: count((r) => r.result.state === "on_break"),
  };
  return { rows, counts };
}

/** One employee's days, newest first. */
export async function employeeDays(employee: Employee, settings: Settings, from: string, to: string) {
  const data = await loadRange(employee.businessId, [employee.id], from, to);
  const now = new Date();
  const rows: DayRow[] = [];
  const first = startDate(employee, settings);
  for (let d = to; d >= from && d >= first; d = addDays(d, -1)) rows.push(buildRow(employee, d, data, settings, now));
  return rows;
}

export async function employeeToday(employee: Employee, settings: Settings) {
  const d = today(settings);
  return (await employeeDays(employee, settings, d, d))[0];
}

const LABEL: Record<EventType, string> = {
  clock_in: "clock in",
  break_start: "start a break",
  break_end: "end your break",
  clock_out: "clock out",
};

/**
 * Record a tap. Checks the tap is allowed in the employee's current state,
 * stores the event, then recalculates the day's attendance summary.
 */
export async function recordTap(employee: Employee, settings: Settings, type: EventType, deviceId?: string) {
  const now = new Date();
  const workDate = localDate(now, settings.timezone);

  return db.transaction(async (tx) => {
    const [scheds, leaves] = await Promise.all([
      tx.select().from(schedules).where(eq(schedules.employeeId, employee.id)),
      tx
        .select()
        .from(leave)
        .where(
          and(
            eq(leave.employeeId, employee.id),
            eq(leave.status, "active"),
            lte(leave.startDate, workDate),
            gte(leave.endDate, workDate),
          ),
        ),
    ]);
    const plan = resolveDayPlan(workDate, scheds, leaves);

    await tx
      .insert(attendance)
      .values({ businessId: employee.businessId, employeeId: employee.id, workDate, status: "absent" })
      .onConflictDoNothing();
    // Lock the day's row so two quick taps can't both pass the state check.
    const [att] = await tx
      .select()
      .from(attendance)
      .where(and(eq(attendance.employeeId, employee.id), eq(attendance.workDate, workDate)))
      .for("update");

    const existing = await tx
      .select()
      .from(attendanceEvents)
      .where(and(eq(attendanceEvents.attendanceId, att.id), eq(attendanceEvents.isVoided, false)));

    if (!allowedActions(tapState(existing)).includes(type)) {
      return { ok: false as const, error: `You can't ${LABEL[type]} right now.` };
    }

    await tx.insert(attendanceEvents).values({
      businessId: employee.businessId,
      employeeId: employee.id,
      attendanceId: att.id,
      eventType: type,
      eventAt: now,
      deviceId,
    });

    const result = computeDay({
      workDate,
      plan,
      taps: [...existing, { eventType: type, eventAt: now }],
      settings: rules(settings),
      now,
    });
    await tx
      .update(attendance)
      .set({
        scheduledStart: result.scheduledStart,
        scheduledEnd: result.scheduledEnd,
        breakAllowanceMinutes: result.breakAllowanceMinutes,
        clockInAt: result.clockInAt,
        clockOutAt: result.clockOutAt,
        // A row only exists once someone has clocked in, so never "not in yet".
        status: result.status === "not_in_yet" ? "absent" : result.status,
        minutesLate: result.minutesLate,
        earlyLeaveMinutes: result.earlyLeaveMinutes,
        breakMinutes: result.breakMinutes,
        hoursWorked: result.hoursWorked,
        overtimeMinutes: result.overtimeMinutes,
        undertimeMinutes: result.undertimeMinutes,
        leaveId: result.leaveId,
      })
      .where(eq(attendance.id, att.id));

    return { ok: true as const, result };
  });
}

export async function saveLateReason(employee: Employee, settings: Settings, reason: string) {
  const workDate = today(settings);
  await db
    .update(attendance)
    .set({ lateReason: reason.slice(0, 500) })
    .where(and(eq(attendance.employeeId, employee.id), eq(attendance.workDate, workDate)));
  await audit({ businessId: employee.businessId, employeeId: employee.id, action: "late_reason_added", targetType: "employee", targetId: employee.id });
}

import "server-only";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { attendance, attendanceEvents, employees, leave, schedules, tapPhotos } from "@/db/schema";
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
import { addDays, localDate, weekday } from "@/lib/time";
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
export async function recordTap(employee: Employee, settings: Settings, type: EventType, photo?: Buffer | null) {
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

    const [event] = await tx
      .insert(attendanceEvents)
      .values({
        businessId: employee.businessId,
        employeeId: employee.id,
        attendanceId: att.id,
        eventType: type,
        eventAt: now,
      })
      .returning({ id: attendanceEvents.id });
    if (photo) {
      await tx.insert(tapPhotos).values({ eventId: event.id, businessId: employee.businessId, employeeId: employee.id, data: photo });
    }

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

export interface DaySummary {
  date: string;
  scheduled: number;
  present: number;
  onTime: number;
  late: number;
  absent: number;
}

export interface PersonSummary {
  employee: Employee;
  scheduledDays: number;
  presentDays: number;
  onTimeDays: number;
  lateDays: number;
  minutesWorked: number;
}

/**
 * Per-day counts and per-person totals over a date range (inclusive), for the
 * trend chart and punctuality leaderboard. Days before someone started are skipped.
 */
export async function rangeOverview(businessId: string, settings: Settings, from: string, to: string) {
  const staff = await db
    .select()
    .from(employees)
    .where(and(eq(employees.businessId, businessId), eq(employees.status, "active")))
    .orderBy(asc(employees.fullName));
  const data = await loadRange(
    businessId,
    staff.map((e) => e.id),
    from,
    to,
  );
  const now = new Date();
  const days: DaySummary[] = [];
  const people = new Map<string, PersonSummary>(
    staff.map((e) => [e.id, { employee: e, scheduledDays: 0, presentDays: 0, onTimeDays: 0, lateDays: 0, minutesWorked: 0 }]),
  );

  for (let d = from; d <= to; d = addDays(d, 1)) {
    const day: DaySummary = { date: d, scheduled: 0, present: 0, onTime: 0, late: 0, absent: 0 };
    for (const e of staff) {
      if (startDate(e, settings) > d) continue;
      const { plan, result: r } = buildRow(e, d, data, settings, now);
      const p = people.get(e.id)!;
      if (plan.kind === "working") {
        day.scheduled++;
        p.scheduledDays++;
      }
      if (r.clockInAt) {
        day.present++;
        p.presentDays++;
      }
      if (r.status === "on_time" || r.status === "grace") {
        day.onTime++;
        p.onTimeDays++;
      }
      if (r.status === "late" || r.status === "attendance_risk") {
        day.late++;
        p.lateDays++;
      }
      if (r.status === "absent") day.absent++;
      p.minutesWorked += Math.round((r.hoursWorked ?? 0) * 60);
    }
    days.push(day);
  }
  return { days, people: [...people.values()] };
}

export interface TapPhoto {
  eventId: string;
  eventType: EventType;
  eventAt: Date;
}

/** Which clock-in / clock-out taps have a photo, for employees on given dates. */
export async function photosFor(businessId: string, employeeIds: string[], from: string, to: string) {
  if (employeeIds.length === 0) return new Map<string, { in?: TapPhoto; out?: TapPhoto; missing: boolean }>();
  const rows = await db
    .select({
      eventId: attendanceEvents.id,
      eventType: attendanceEvents.eventType,
      eventAt: attendanceEvents.eventAt,
      employeeId: attendanceEvents.employeeId,
      workDate: attendance.workDate,
      photo: tapPhotos.eventId,
    })
    .from(attendanceEvents)
    .innerJoin(attendance, eq(attendance.id, attendanceEvents.attendanceId))
    .leftJoin(tapPhotos, eq(tapPhotos.eventId, attendanceEvents.id))
    .where(
      and(
        eq(attendance.businessId, businessId),
        inArray(attendance.employeeId, employeeIds),
        gte(attendance.workDate, from),
        lte(attendance.workDate, to),
        eq(attendanceEvents.isVoided, false),
        inArray(attendanceEvents.eventType, ["clock_in", "clock_out"]),
      ),
    );
  // Keyed by `${employeeId}:${workDate}`.
  const out = new Map<string, { in?: TapPhoto; out?: TapPhoto; missing: boolean }>();
  for (const r of rows) {
    const key = `${r.employeeId}:${r.workDate}`;
    const entry = out.get(key) ?? { missing: false };
    if (!r.photo) entry.missing = true;
    else if (r.eventType === "clock_in") entry.in = { eventId: r.eventId, eventType: r.eventType, eventAt: r.eventAt };
    else entry.out = { eventId: r.eventId, eventType: r.eventType, eventAt: r.eventAt };
    out.set(key, entry);
  }
  return out;
}

export interface RotaCell {
  date: string;
  plan: DayPlan;
  /** A one-off change for this date (rather than the weekly pattern). */
  override: { startTime: string | null; endTime: string | null; isDayOff: boolean; breakMinutes: number } | null;
  /** What actually happened, for today and past days. */
  status: DayResult["status"] | null;
  breakMinutes: number;
}

/** Every active employee's week: planned shift per day plus actual status so far. */
export async function weekRota(businessId: string, settings: Settings, monday: string) {
  const sunday = addDays(monday, 6);
  const staff = await db
    .select()
    .from(employees)
    .where(and(eq(employees.businessId, businessId), eq(employees.status, "active")))
    .orderBy(asc(employees.fullName));
  const data = await loadRange(
    businessId,
    staff.map((e) => e.id),
    monday,
    sunday,
  );
  const now = new Date();
  const todayStr = localDate(now, settings.timezone);
  return staff.map((e) => {
    const cells: RotaCell[] = [];
    for (let d = monday; d <= sunday; d = addDays(d, 1)) {
      const row = buildRow(e, d, data, settings, now);
      const o = data.scheds.find((s) => s.employeeId === e.id && s.shiftDate === d);
      const weekly = data.scheds.find((s) => s.employeeId === e.id && s.shiftDate === null && s.dayOfWeek === weekday(d));
      cells.push({
        date: d,
        plan: row.plan,
        override: o ? { startTime: o.startTime, endTime: o.endTime, isDayOff: o.isDayOff, breakMinutes: o.breakMinutes } : null,
        status: d <= todayStr && startDate(e, settings) <= d ? row.result.status : null,
        breakMinutes: (o ?? weekly)?.breakMinutes ?? settings.defaultBreakMinutes,
      });
    }
    return { employee: e, cells };
  });
}

export interface PayrollRow {
  employee: Employee;
  scheduledDays: number;
  daysWorked: number;
  onTime: number;
  late: number;
  absent: number;
  leaveDays: number;
  offDaysWorked: number;
  minutesWorked: number;
  overtimeMinutes: number;
  undertimeMinutes: number;
  breakMinutes: number;
  minutesLate: number;
  missingClockOuts: number;
}

/**
 * Totals per person for a period, plus every day's detail, for payroll.
 * Only days up to today count, and only from each person's start date.
 */
export async function payrollReport(businessId: string, settings: Settings, from: string, to: string) {
  const todayStr = localDate(new Date(), settings.timezone);
  const end = to > todayStr ? todayStr : to;
  const staff = await db
    .select()
    .from(employees)
    .where(eq(employees.businessId, businessId))
    .orderBy(asc(employees.fullName));
  const data = await loadRange(
    businessId,
    staff.map((e) => e.id),
    from,
    end,
  );
  const now = new Date();
  const daily: DayRow[] = [];
  const rows: PayrollRow[] = staff.map((e) => {
    const t: PayrollRow = {
      employee: e,
      scheduledDays: 0,
      daysWorked: 0,
      onTime: 0,
      late: 0,
      absent: 0,
      leaveDays: 0,
      offDaysWorked: 0,
      minutesWorked: 0,
      overtimeMinutes: 0,
      undertimeMinutes: 0,
      breakMinutes: 0,
      minutesLate: 0,
      missingClockOuts: 0,
    };
    for (let d = from; d <= end; d = addDays(d, 1)) {
      if (startDate(e, settings) > d) continue;
      const row = buildRow(e, d, data, settings, now);
      const r = row.result;
      // Inactive staff only appear for days they actually worked.
      if (e.status !== "active" && !r.clockInAt) continue;
      daily.push(row);
      if (row.plan.kind === "working") t.scheduledDays++;
      if (r.clockInAt) t.daysWorked++;
      if (r.status === "on_time" || r.status === "grace") t.onTime++;
      if (r.status === "late" || r.status === "attendance_risk") t.late++;
      if (r.status === "absent") t.absent++;
      if (r.status === "on_leave" || (row.plan.kind === "working" && row.plan.halfDay)) t.leaveDays += row.plan.kind === "leave" ? 1 : 0.5;
      if (r.status === "worked_off_day") t.offDaysWorked++;
      t.minutesWorked += Math.round((r.hoursWorked ?? 0) * 60);
      t.overtimeMinutes += r.overtimeMinutes;
      t.undertimeMinutes += r.undertimeMinutes;
      t.breakMinutes += r.breakMinutes;
      t.minutesLate += r.minutesLate;
      if (r.missingClockOut) t.missingClockOuts++;
    }
    return t;
  });
  return { from, to: end, rows: rows.filter((r) => r.employee.status === "active" || r.daysWorked > 0), daily };
}

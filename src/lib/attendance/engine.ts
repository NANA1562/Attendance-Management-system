// The attendance engine: turns a schedule, leave and a day's taps into an
// attendance result. Pure functions only — no database — so every rule is
// unit tested in engine.test.ts.

import {
  addDays,
  localDate,
  minutesBetween,
  minutesToTime,
  timeToMinutes,
  weekday,
  zonedToUtc,
} from "@/lib/time";

export type EventType = "clock_in" | "break_start" | "break_end" | "clock_out";
export type DayPart = "full_day" | "morning_off" | "afternoon_off";
export type AttendanceStatus =
  | "on_time"
  | "grace"
  | "late"
  | "attendance_risk"
  | "absent"
  | "off_day"
  | "worked_off_day"
  | "on_leave";
/** Display-only: scheduled today, not clocked in, not yet past the absent cutoff. */
export type LiveStatus = AttendanceStatus | "not_in_yet";
export type TapState = "not_clocked_in" | "working" | "on_break" | "clocked_out";

export interface ScheduleRow {
  dayOfWeek: number | null;
  shiftDate: string | null;
  startTime: string | null;
  endTime: string | null;
  isDayOff: boolean;
  breakMinutes: number;
}

export interface LeaveRow {
  id: string;
  dayPart: DayPart;
  startDate: string;
  endDate: string;
  status: "active" | "cancelled";
}

export interface RuleSettings {
  graceMinutes: number;
  lateUntilMinutes: number;
  absentAfterMinutes: number;
  timezone: string;
}

export interface Tap {
  eventType: EventType;
  eventAt: Date;
}

export type DayPlan =
  | { kind: "off"; reason: "day_off" | "unscheduled" }
  | { kind: "leave"; leaveId: string }
  | {
      kind: "working";
      start: string; // 'HH:MM' local
      end: string;
      breakAllowance: number;
      leaveId: string | null;
      halfDay: "morning_off" | "afternoon_off" | null;
    };

/**
 * What the employee is expected to do on a date.
 * A one-off date override beats the weekly pattern. No schedule = off.
 * Half-day leave splits the shift at its midpoint and drops the break allowance.
 */
export function resolveDayPlan(
  workDate: string,
  schedules: ScheduleRow[],
  leaves: LeaveRow[],
): DayPlan {
  const row =
    schedules.find((s) => s.shiftDate === workDate) ??
    schedules.find((s) => s.shiftDate === null && s.dayOfWeek === weekday(workDate));

  if (!row) return { kind: "off", reason: "unscheduled" };
  if (row.isDayOff || !row.startTime || !row.endTime) return { kind: "off", reason: "day_off" };

  const onLeave = leaves.find(
    (l) => l.status === "active" && l.startDate <= workDate && l.endDate >= workDate,
  );
  const start = row.startTime.slice(0, 5);
  const end = row.endTime.slice(0, 5);

  if (!onLeave) {
    return { kind: "working", start, end, breakAllowance: row.breakMinutes, leaveId: null, halfDay: null };
  }
  if (onLeave.dayPart === "full_day") return { kind: "leave", leaveId: onLeave.id };

  const mid = minutesToTime(Math.floor((timeToMinutes(start) + timeToMinutes(end)) / 2));
  return onLeave.dayPart === "morning_off"
    ? { kind: "working", start: mid, end, breakAllowance: 0, leaveId: onLeave.id, halfDay: "morning_off" }
    : { kind: "working", start, end: mid, breakAllowance: 0, leaveId: onLeave.id, halfDay: "afternoon_off" };
}

/** Status for a clock-in that is `minutesLate` after the scheduled start. */
export function classifyArrival(minutesLate: number, s: RuleSettings): AttendanceStatus {
  if (minutesLate <= 0) return "on_time";
  if (minutesLate <= s.graceMinutes) return "grace";
  if (minutesLate <= s.lateUntilMinutes) return "late";
  // Anything later — including past the absent cutoff — is attendance risk.
  // "Absent" is only for people who never clock in.
  return "attendance_risk";
}

export function tapState(taps: Tap[]): TapState {
  let state: TapState = "not_clocked_in";
  for (const t of sortTaps(taps)) {
    if (t.eventType === "clock_in") state = "working";
    else if (t.eventType === "break_start") state = "on_break";
    else if (t.eventType === "break_end") state = "working";
    else if (t.eventType === "clock_out") state = "clocked_out";
  }
  return state;
}

/** The buttons to show the employee for their current state. */
export function allowedActions(state: TapState): EventType[] {
  switch (state) {
    case "not_clocked_in":
      return ["clock_in"];
    case "working":
      return ["break_start", "clock_out"];
    case "on_break":
      return ["break_end"];
    case "clocked_out":
      return [];
  }
}

export interface DayResult {
  status: LiveStatus;
  state: TapState;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  breakAllowanceMinutes: number;
  clockInAt: Date | null;
  clockOutAt: Date | null;
  minutesLate: number;
  earlyLeaveMinutes: number;
  breakMinutes: number;
  /** Null until the employee clocks out. */
  hoursWorked: number | null;
  overtimeMinutes: number;
  undertimeMinutes: number;
  /** Clocked in, never clocked out, and the shift (or day) is over. */
  missingClockOut: boolean;
  leaveId: string | null;
  /** Worked and break periods in order, for drawing a timeline. */
  segments: Segment[];
}

export interface Segment {
  kind: "work" | "break";
  from: Date;
  to: Date;
  /** Still running (no closing tap yet); `to` is now, capped at the end of the day. */
  open: boolean;
}

/** Split a day's taps into worked and break periods. */
export function segmentsFromTaps(taps: Tap[], workDate: string, now: Date, timeZone: string): Segment[] {
  const dayEnd = zonedToUtc(addDays(workDate, 1), "00:00", timeZone);
  const openEnd = now < dayEnd ? now : dayEnd;
  const out: Segment[] = [];
  let current: { kind: Segment["kind"]; from: Date } | null = null;
  const close = (to: Date) => {
    if (current && to > current.from) out.push({ ...current, to, open: false });
    current = null;
  };
  for (const t of sortTaps(taps)) {
    if (t.eventType === "clock_in" && !current) current = { kind: "work", from: t.eventAt };
    else if (t.eventType === "break_start" && current?.kind === "work") {
      close(t.eventAt);
      current = { kind: "break", from: t.eventAt };
    } else if (t.eventType === "break_end" && current?.kind === "break") {
      close(t.eventAt);
      current = { kind: "work", from: t.eventAt };
    } else if (t.eventType === "clock_out") close(t.eventAt);
  }
  const last = current as { kind: Segment["kind"]; from: Date } | null;
  if (last && openEnd > last.from) out.push({ ...last, to: openEnd, open: true });
  return out;
}

export function computeDay(input: {
  workDate: string;
  plan: DayPlan;
  taps: Tap[];
  settings: RuleSettings;
  now: Date;
}): DayResult {
  const { workDate, plan, settings, now } = input;
  const tz = settings.timezone;
  const taps = sortTaps(input.taps);

  const clockIn = taps.find((t) => t.eventType === "clock_in")?.eventAt ?? null;
  const clockOut = clockIn
    ? (taps.filter((t) => t.eventType === "clock_out").at(-1)?.eventAt ?? null)
    : null;

  // Sum break pairs. An open break ends at clock-out, or now if still on break.
  let breakMinutes = 0;
  let openBreak: Date | null = null;
  for (const t of taps) {
    if (t.eventType === "break_start" && !openBreak) openBreak = t.eventAt;
    if (t.eventType === "break_end" && openBreak) {
      breakMinutes += minutesBetween(openBreak, t.eventAt);
      openBreak = null;
    }
  }
  if (openBreak) breakMinutes += minutesBetween(openBreak, clockOut ?? now);

  const working = plan.kind === "working" ? plan : null;
  const startAt = working ? zonedToUtc(workDate, working.start, tz) : null;
  const endAt = working ? zonedToUtc(workDate, working.end, tz) : null;
  const allowance = working?.breakAllowance ?? 0;

  // Hours: clock time minus breaks. Once someone has worked at least half
  // their shift, the break allowance is deducted even if they skipped lunch
  // (so skipping doesn't create overtime); a longer break costs its real time.
  // Before half the shift — e.g. sent home sick — only actual breaks count.
  let workedMinutes: number | null = null;
  if (clockIn && clockOut) {
    const gross = Math.max(0, minutesBetween(clockIn, clockOut));
    const shiftMinutes = working ? minutesBetween(startAt!, endAt!) : 0;
    const allowanceDue = gross >= shiftMinutes / 2 ? allowance : 0;
    workedMinutes = Math.max(0, gross - Math.max(breakMinutes, allowanceDue));
  }

  let status: LiveStatus;
  let minutesLate = 0;
  let earlyLeaveMinutes = 0;
  let overtimeMinutes = 0;
  let undertimeMinutes = 0;

  if (plan.kind === "leave") {
    status = "on_leave";
  } else if (plan.kind === "off") {
    status = clockIn ? "worked_off_day" : "off_day";
    // All time worked on an off day is extra.
    overtimeMinutes = workedMinutes ?? 0;
  } else if (clockIn) {
    minutesLate = Math.max(0, minutesBetween(startAt!, clockIn));
    status = classifyArrival(minutesLate, settings);
    if (clockOut && workedMinutes !== null) {
      const expected = minutesBetween(startAt!, endAt!) - allowance;
      overtimeMinutes = Math.max(0, workedMinutes - expected);
      undertimeMinutes = Math.max(0, expected - workedMinutes);
      earlyLeaveMinutes = Math.max(0, minutesBetween(clockOut, endAt!));
    }
  } else {
    const absentAt = new Date(startAt!.getTime() + settings.absentAfterMinutes * 60000);
    status = now >= absentAt ? "absent" : "not_in_yet";
  }

  const dayOver = endAt ? now > endAt : localDate(now, tz) > workDate;
  const missingClockOut = !!clockIn && !clockOut && dayOver;

  return {
    status,
    state: tapState(taps),
    scheduledStart: working?.start ?? null,
    scheduledEnd: working?.end ?? null,
    breakAllowanceMinutes: allowance,
    clockInAt: clockIn,
    clockOutAt: clockOut,
    minutesLate,
    earlyLeaveMinutes,
    breakMinutes,
    hoursWorked: workedMinutes === null ? null : Math.round((workedMinutes / 60) * 100) / 100,
    overtimeMinutes,
    undertimeMinutes,
    missingClockOut,
    leaveId: plan.kind === "leave" ? plan.leaveId : (working?.leaveId ?? null),
    segments: segmentsFromTaps(taps, workDate, now, tz),
  };
}

/** True once the local day for `workDate` has fully ended. */
export function isPastDate(workDate: string, now: Date, timeZone: string): boolean {
  return localDate(now, timeZone) >= addDays(workDate, 1);
}

function sortTaps(taps: Tap[]): Tap[] {
  return [...taps].sort((a, b) => a.eventAt.getTime() - b.eventAt.getTime());
}

import { describe, expect, it } from "vitest";
import {
  allowedActions,
  classifyArrival,
  computeDay,
  resolveDayPlan,
  tapState,
  type EventType,
  type LeaveRow,
  type RuleSettings,
  type ScheduleRow,
} from "./engine";

const settings: RuleSettings = {
  graceMinutes: 35,
  lateUntilMinutes: 70,
  absentAfterMinutes: 120,
  timezone: "Africa/Accra", // UTC+0
};

// 2026-10-05 is a Monday.
const MONDAY = "2026-10-05";
const weekly = (dayOfWeek: number, start = "08:00", end = "17:00"): ScheduleRow => ({
  dayOfWeek,
  shiftDate: null,
  startTime: start,
  endTime: end,
  isDayOff: false,
  breakMinutes: 60,
});
const dayOff = (dayOfWeek: number): ScheduleRow => ({
  dayOfWeek,
  shiftDate: null,
  startTime: null,
  endTime: null,
  isDayOff: true,
  breakMinutes: 0,
});
const monToFri = [1, 2, 3, 4, 5].map((d) => weekly(d)).concat([dayOff(6), dayOff(0)]);

const at = (time: string, date = MONDAY) => new Date(`${date}T${time}:00Z`);
const tap = (eventType: EventType, time: string, date = MONDAY) => ({ eventType, eventAt: at(time, date) });

function day(taps: ReturnType<typeof tap>[], now: string, opts: { schedules?: ScheduleRow[]; leaves?: LeaveRow[]; date?: string } = {}) {
  const workDate = opts.date ?? MONDAY;
  const plan = resolveDayPlan(workDate, opts.schedules ?? monToFri, opts.leaves ?? []);
  return computeDay({ workDate, plan, taps, settings, now: at(now, workDate) });
}

describe("Baffour's Day 3 scenarios", () => {
  it("on-time employee: full day, standard break", () => {
    const r = day(
      [tap("clock_in", "07:55"), tap("break_start", "12:00"), tap("break_end", "12:45"), tap("clock_out", "17:00")],
      "18:00",
    );
    expect(r.status).toBe("on_time");
    expect(r.minutesLate).toBe(0);
    expect(r.breakMinutes).toBe(45);
    // 9h05m on the clock − 60m allowance (break was shorter) = 8h05m
    expect(r.hoursWorked).toBe(8.08);
    expect(r.overtimeMinutes).toBe(5);
    expect(r.undertimeMinutes).toBe(0);
  });

  it("late employee", () => {
    const r = day([tap("clock_in", "08:50"), tap("clock_out", "17:00")], "18:00");
    expect(r.status).toBe("late");
    expect(r.minutesLate).toBe(50);
    expect(r.undertimeMinutes).toBe(50);
  });

  it("early departure", () => {
    const r = day([tap("clock_in", "08:00"), tap("clock_out", "15:30")], "18:00");
    expect(r.status).toBe("on_time");
    expect(r.earlyLeaveMinutes).toBe(90);
    expect(r.hoursWorked).toBe(6.5);
    expect(r.undertimeMinutes).toBe(90);
  });

  it("employee on full-day leave", () => {
    const leaves: LeaveRow[] = [
      { id: "L1", dayPart: "full_day", startDate: "2026-10-04", endDate: "2026-10-06", status: "active" },
    ];
    const r = day([], "12:00", { leaves });
    expect(r.status).toBe("on_leave");
    expect(r.leaveId).toBe("L1");
  });

  it("cancelled leave is ignored", () => {
    const leaves: LeaveRow[] = [
      { id: "L1", dayPart: "full_day", startDate: MONDAY, endDate: MONDAY, status: "cancelled" },
    ];
    expect(day([], "12:00", { leaves }).status).toBe("absent");
  });

  it("employee on OFF day", () => {
    const r = day([], "12:00", { date: "2026-10-10" }); // Saturday
    expect(r.status).toBe("off_day");
  });

  it("works on an off day: all hours are overtime", () => {
    const SAT = "2026-10-10";
    const r = day([tap("clock_in", "09:00", SAT), tap("clock_out", "13:00", SAT)], "14:00", { date: SAT });
    expect(r.status).toBe("worked_off_day");
    expect(r.hoursWorked).toBe(4);
    expect(r.overtimeMinutes).toBe(240);
  });

  it("overtime", () => {
    const r = day(
      [tap("clock_in", "08:00"), tap("break_start", "12:00"), tap("break_end", "13:00"), tap("clock_out", "19:00")],
      "20:00",
    );
    expect(r.hoursWorked).toBe(10);
    expect(r.overtimeMinutes).toBe(120);
    expect(r.undertimeMinutes).toBe(0);
  });

  it("no clock-out: no hours, flagged once the shift is over", () => {
    const during = day([tap("clock_in", "08:00")], "15:00");
    expect(during.hoursWorked).toBeNull();
    expect(during.missingClockOut).toBe(false);
    expect(during.state).toBe("working");

    const after = day([tap("clock_in", "08:00")], "18:00");
    expect(after.hoursWorked).toBeNull();
    expect(after.missingClockOut).toBe(true);
  });
});

describe("arrival thresholds", () => {
  it.each([
    [0, "on_time"],
    [1, "grace"],
    [35, "grace"],
    [36, "late"],
    [70, "late"],
    [71, "attendance_risk"],
    [120, "attendance_risk"],
    [200, "attendance_risk"], // clocks in after the absent cutoff
  ])("%i minutes late → %s", (minutes, status) => {
    expect(classifyArrival(minutes, settings)).toBe(status);
  });

  it("arriving early counts as on time", () => {
    expect(day([tap("clock_in", "07:30")], "09:00").status).toBe("on_time");
  });

  it("seconds don't count: 08:00:59 is on time", () => {
    const r = day([{ eventType: "clock_in", eventAt: new Date(`${MONDAY}T08:00:59Z`) }], "09:00");
    expect(r.status).toBe("on_time");
  });
});

describe("not clocked in", () => {
  it("before the absent cutoff → not in yet", () => {
    expect(day([], "09:59").status).toBe("not_in_yet");
  });
  it("at 2 hours past start → absent", () => {
    expect(day([], "10:00").status).toBe("absent");
  });
});

describe("schedules", () => {
  it("no schedule row for the weekday → off (unscheduled)", () => {
    const plan = resolveDayPlan(MONDAY, [weekly(2)], []);
    expect(plan).toEqual({ kind: "off", reason: "unscheduled" });
  });

  it("a one-off date override beats the weekly pattern", () => {
    const override: ScheduleRow = { ...weekly(1, "10:00", "14:00"), dayOfWeek: null, shiftDate: MONDAY };
    const plan = resolveDayPlan(MONDAY, [...monToFri, override], []);
    expect(plan).toMatchObject({ kind: "working", start: "10:00", end: "14:00" });
  });

  it("an off day stays off even with leave on it", () => {
    const leaves: LeaveRow[] = [{ id: "L", dayPart: "full_day", startDate: "2026-10-10", endDate: "2026-10-10", status: "active" }];
    expect(resolveDayPlan("2026-10-10", monToFri, leaves).kind).toBe("off");
  });
});

describe("half-day leave (shift 08:00–17:00, midpoint 12:30)", () => {
  const leave = (dayPart: "morning_off" | "afternoon_off"): LeaveRow[] => [
    { id: "H", dayPart, startDate: MONDAY, endDate: MONDAY, status: "active" },
  ];

  it("morning off: expected 12:30–17:00, lateness from 12:30", () => {
    const r = day([tap("clock_in", "12:40"), tap("clock_out", "17:00")], "18:00", { leaves: leave("morning_off") });
    expect(r.scheduledStart).toBe("12:30");
    expect(r.status).toBe("grace");
    expect(r.minutesLate).toBe(10);
    expect(r.breakAllowanceMinutes).toBe(0);
    expect(r.undertimeMinutes).toBe(10);
  });

  it("afternoon off: expected 08:00–12:30, absent measured from 08:00", () => {
    const r = day([], "10:00", { leaves: leave("afternoon_off") });
    expect(r.scheduledEnd).toBe("12:30");
    expect(r.status).toBe("absent");
  });
});

describe("breaks", () => {
  it("a break longer than the allowance costs hours", () => {
    const r = day(
      [tap("clock_in", "08:00"), tap("break_start", "12:00"), tap("break_end", "13:30"), tap("clock_out", "17:00")],
      "18:00",
    );
    expect(r.breakMinutes).toBe(90);
    expect(r.hoursWorked).toBe(7.5);
    expect(r.undertimeMinutes).toBe(30);
  });

  it("multiple breaks are summed", () => {
    const r = day(
      [
        tap("clock_in", "08:00"),
        tap("break_start", "10:00"),
        tap("break_end", "10:15"),
        tap("break_start", "13:00"),
        tap("break_end", "13:50"),
        tap("clock_out", "17:00"),
      ],
      "18:00",
    );
    expect(r.breakMinutes).toBe(65);
    expect(r.hoursWorked).toBe(7.92);
  });

  it("a short day (under half the shift) only deducts breaks actually taken", () => {
    // Sent home after 3 hours, no break: 3h worked, not 2h.
    const r = day([tap("clock_in", "08:00"), tap("clock_out", "11:00")], "12:00");
    expect(r.hoursWorked).toBe(3);
    expect(r.undertimeMinutes).toBe(300);
  });

  it("past half the shift, the allowance applies even with no break", () => {
    // 08:00–13:00 is 5h of a 9h shift: allowance (60) applies → 4h.
    const r = day([tap("clock_in", "08:00"), tap("clock_out", "13:00")], "14:00");
    expect(r.hoursWorked).toBe(4);
  });

  it("an open break counts up to now", () => {
    const r = day([tap("clock_in", "08:00"), tap("break_start", "12:00")], "12:20");
    expect(r.state).toBe("on_break");
    expect(r.breakMinutes).toBe(20);
  });
});

describe("tap state machine", () => {
  it("walks clock in → break → clock out", () => {
    expect(allowedActions(tapState([]))).toEqual(["clock_in"]);
    expect(allowedActions(tapState([tap("clock_in", "08:00")]))).toEqual(["break_start", "clock_out"]);
    expect(allowedActions(tapState([tap("clock_in", "08:00"), tap("break_start", "12:00")]))).toEqual(["break_end"]);
    expect(allowedActions(tapState([tap("clock_in", "08:00"), tap("clock_out", "17:00")]))).toEqual([]);
  });
});

describe("timezones", () => {
  it("uses the business timezone, not UTC", () => {
    // Lagos is UTC+1: an 08:00 local start is 07:00 UTC.
    const lagos = { ...settings, timezone: "Africa/Lagos" };
    const plan = resolveDayPlan(MONDAY, monToFri, []);
    const r = computeDay({
      workDate: MONDAY,
      plan,
      taps: [{ eventType: "clock_in", eventAt: new Date(`${MONDAY}T07:20:00Z`) }],
      settings: lagos,
      now: new Date(`${MONDAY}T09:00:00Z`),
    });
    expect(r.minutesLate).toBe(20);
    expect(r.status).toBe("grace");
  });
});

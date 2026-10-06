import type { LiveStatus } from "@/lib/attendance/engine";
import { localTime } from "@/lib/time";

export const STATUS_LABEL: Record<LiveStatus, string> = {
  on_time: "On time",
  grace: "Grace",
  late: "Late",
  attendance_risk: "Attendance risk",
  absent: "Absent",
  off_day: "Off day",
  worked_off_day: "Worked on off day",
  on_leave: "On leave",
  not_in_yet: "Not in yet",
};

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function clock(d: Date | null, timeZone: string) {
  return d ? localTime(d, timeZone) : "—";
}

/** 90 → "1h 30m", 0 → "—" */
export function duration(minutes: number) {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

/** Hours worked as "8h 5m"; "0m" for a zero-length day, "—" if not clocked out. */
export function hours(h: number | null) {
  if (h === null) return "—";
  const m = Math.round(h * 60);
  return m === 0 ? "0m" : duration(m);
}

/** '2026-10-06' → 'Tue 6 Oct' */
export function prettyDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

// Which task templates produce a daily task for an employee on a date.

import { weekday } from "@/lib/time";

export type Frequency = "daily" | "weekly" | "specific_days" | "monthly" | "one_time" | "shift_based";

export interface TemplateSchedule {
  frequency: Frequency;
  daysOfWeek: number[] | null;
  dayOfMonth: number | null;
  oneTimeDate: string | null;
}

/**
 * Recurring tasks only land on days the employee is working (scheduled shift
 * or worked an off day). A one-time task lands on its date regardless.
 */
export function isTemplateDue(t: TemplateSchedule, workDate: string, isWorkingDay: boolean): boolean {
  switch (t.frequency) {
    case "one_time":
      return t.oneTimeDate === workDate;
    case "daily":
    case "shift_based":
      return isWorkingDay;
    case "weekly":
    case "specific_days":
      return isWorkingDay && (t.daysOfWeek ?? []).includes(weekday(workDate));
    case "monthly":
      return isWorkingDay && t.dayOfMonth === Number(workDate.slice(8, 10));
  }
}

import { describe, expect, it } from "vitest";
import { isTemplateDue, type TemplateSchedule } from "./due";

const base: TemplateSchedule = { frequency: "daily", daysOfWeek: null, dayOfMonth: null, oneTimeDate: null };
const MONDAY = "2026-10-05";

describe("isTemplateDue", () => {
  it("daily: every working day only", () => {
    expect(isTemplateDue(base, MONDAY, true)).toBe(true);
    expect(isTemplateDue(base, MONDAY, false)).toBe(false);
  });
  it("weekly / specific days: matching weekday", () => {
    const t = { ...base, frequency: "specific_days" as const, daysOfWeek: [1, 5] };
    expect(isTemplateDue(t, MONDAY, true)).toBe(true);
    expect(isTemplateDue(t, "2026-10-06", true)).toBe(false);
  });
  it("monthly: matching day of month", () => {
    const t = { ...base, frequency: "monthly" as const, dayOfMonth: 5 };
    expect(isTemplateDue(t, MONDAY, true)).toBe(true);
    expect(isTemplateDue(t, "2026-10-06", true)).toBe(false);
  });
  it("one-time: its date, even on a day off", () => {
    const t = { ...base, frequency: "one_time" as const, oneTimeDate: MONDAY };
    expect(isTemplateDue(t, MONDAY, false)).toBe(true);
    expect(isTemplateDue(t, "2026-10-06", true)).toBe(false);
  });
});

import { addDays, weekday } from "@/lib/time";

export type PeriodKey = "this_week" | "last_week" | "this_month" | "last_month" | "custom";

export const PERIOD_LABEL: Record<Exclude<PeriodKey, "custom">, string> = {
  this_week: "This week",
  last_week: "Last week",
  this_month: "This month",
  last_month: "Last month",
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Inclusive [from, to] for a named period relative to `today` (weeks start Monday). */
export function periodRange(key: Exclude<PeriodKey, "custom">, today: string): { from: string; to: string } {
  const monday = addDays(today, -((weekday(today) + 6) % 7));
  const [y, m] = today.split("-").map(Number);
  const monthStart = (yy: number, mm: number) => `${yy}-${pad(mm)}-01`;
  const monthEnd = (yy: number, mm: number) => `${yy}-${pad(mm)}-${pad(new Date(Date.UTC(yy, mm, 0)).getUTCDate())}`;
  switch (key) {
    case "this_week":
      return { from: monday, to: addDays(monday, 6) };
    case "last_week":
      return { from: addDays(monday, -7), to: addDays(monday, -1) };
    case "this_month":
      return { from: monthStart(y, m), to: monthEnd(y, m) };
    case "last_month": {
      const [py, pm] = m === 1 ? [y - 1, 12] : [y, m - 1];
      return { from: monthStart(py, pm), to: monthEnd(py, pm) };
    }
  }
}

/** Resolve query params to a period, capped at 93 days. */
export function resolvePeriod(sp: { period?: string; from?: string; to?: string }, today: string) {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (sp.period === "custom" && sp.from && sp.to && iso.test(sp.from) && iso.test(sp.to) && sp.from <= sp.to) {
    const to = sp.to > addDays(sp.from, 92) ? addDays(sp.from, 92) : sp.to;
    return { key: "custom" as PeriodKey, from: sp.from, to };
  }
  const key = (sp.period && sp.period in PERIOD_LABEL ? sp.period : "this_week") as Exclude<PeriodKey, "custom">;
  return { key: key as PeriodKey, ...periodRange(key, today) };
}

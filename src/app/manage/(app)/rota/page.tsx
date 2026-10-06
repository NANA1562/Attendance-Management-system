import { eq } from "drizzle-orm";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/db";
import { jobRoles } from "@/db/schema";
import { Card, Chip, cx, PageHeader, Person, STATUS_STYLE } from "@/components/ui";
import { DAY_SHORT, duration, prettyDate, STATUS_LABEL } from "@/lib/format";
import { addDays, timeToMinutes, weekday } from "@/lib/time";
import { date as dateSchema } from "@/lib/validation";
import { today, weekRota } from "@/server/attendance";
import { requireManager } from "@/server/auth";
import { RotaCell, type CellView } from "./rota-cell";

const mondayOf = (d: string) => addDays(d, -((weekday(d) + 6) % 7));

export default async function RotaPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { business, settings } = await requireManager();
  const sp = await searchParams;
  const now = today(settings);
  const monday = mondayOf(dateSchema.safeParse(sp.week).success ? sp.week! : now);
  const thisMonday = mondayOf(now);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const [rota, roles] = await Promise.all([
    weekRota(business.id, settings, monday),
    db.select().from(jobRoles).where(eq(jobRoles.businessId, business.id)),
  ]);

  const minutesOf = (c: (typeof rota)[number]["cells"][number]) =>
    c.plan.kind === "working" ? Math.max(0, timeToMinutes(c.plan.end) - timeToMinutes(c.plan.start) - c.plan.breakAllowance) : 0;
  const perDay = days.map((_, i) => rota.filter((r) => r.cells[i].plan.kind === "working").length);
  const totalMinutes = rota.reduce((s, r) => s + r.cells.reduce((t, c) => t + minutesOf(c), 0), 0);

  return (
    <>
      <PageHeader
        icon={CalendarRange}
        title="Rota"
        description="Everyone's week at a glance. Click a day to change just that day. Their usual pattern stays the same."
        actions={
          <>
            <Chip href={`/manage/rota?week=${addDays(monday, -7)}`} icon={ChevronLeft} title="Previous week" className="px-2.5" />
            <Chip icon={CalendarDays}>{prettyDate(monday).slice(4)} – {prettyDate(addDays(monday, 6)).slice(4)}</Chip>
            <Chip href={`/manage/rota?week=${addDays(monday, 7)}`} icon={ChevronRight} title="Next week" className="px-2.5" />
            {monday !== thisMonday && <Chip href="/manage/rota" active>This week</Chip>}
          </>
        }
      />

      <Card flush>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-[220px] border-b border-line bg-subtle px-5 py-2.5 text-left font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted">Staff</th>
                {days.map((d) => (
                  <th key={d} className={cx("border-b border-line bg-subtle px-1.5 py-2.5 text-left", d === now && "bg-accent-50")}>
                    <div className={cx("font-mono text-[11px] uppercase tracking-[0.1em]", d === now ? "text-accent-700" : "text-muted")}>{DAY_SHORT[weekday(d)]}</div>
                    <div className={cx("text-[13px] font-semibold", d === now ? "text-accent-700" : "text-ink")}>{Number(d.slice(8))}{d === now && " · Today"}</div>
                  </th>
                ))}
                <th className="border-b border-line bg-subtle px-5 py-2.5 text-right font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted">Hours</th>
              </tr>
            </thead>
            <tbody>
              {rota.map(({ employee: e, cells }) => {
                const weekMinutes = cells.reduce((t, c) => t + minutesOf(c), 0);
                return (
                  <tr key={e.id}>
                    <td className="sticky left-0 z-10 border-b border-line bg-surface px-5 py-2">
                      <Person name={e.fullName} href={`/manage/staff/${e.id}`} />
                      <div className="ml-8 text-xs text-muted">{roles.find((r) => r.id === e.roleId)?.name ?? "No role"}</div>
                    </td>
                    {cells.map((c) => {
                      const view: CellView = {
                        employeeId: e.id,
                        employeeName: e.fullName,
                        date: c.date,
                        dateLabel: prettyDate(c.date),
                        kind: c.plan.kind === "working" ? "working" : c.plan.kind === "leave" ? "leave" : "off",
                        start: c.plan.kind === "working" ? c.plan.start : (c.override?.startTime?.slice(0, 5) ?? null),
                        end: c.plan.kind === "working" ? c.plan.end : (c.override?.endTime?.slice(0, 5) ?? null),
                        breakMinutes: c.breakMinutes,
                        override: !!c.override,
                        halfDay: c.plan.kind === "working" && !!c.plan.halfDay,
                        editable: c.date >= now && c.plan.kind !== "leave",
                        isToday: c.date === now,
                        statusDot: c.status && c.status !== "off_day" && c.status !== "on_leave" ? STATUS_STYLE[c.status].dot : null,
                        statusLabel: c.status ? STATUS_LABEL[c.status] : null,
                      };
                      return (
                        <td key={c.date} className={cx("border-b border-line px-1.5 py-2 align-top", c.date === now && "bg-accent-50/40")}>
                          <RotaCell cell={view} />
                        </td>
                      );
                    })}
                    <td className="border-b border-line px-5 py-2 text-right font-mono tabular-nums">{duration(weekMinutes) === "—" ? "0h" : duration(weekMinutes)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="sticky left-0 bg-subtle px-5 py-3 text-xs font-medium text-muted">Scheduled</td>
                {perDay.map((n, i) => (
                  <td key={i} className="whitespace-nowrap bg-subtle px-3 py-3 font-mono text-xs text-ink-2">{n} staff</td>
                ))}
                <td className="bg-subtle px-5 py-3 text-right font-mono text-xs font-semibold">{duration(totalMinutes) === "—" ? "0h" : duration(totalMinutes)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-5 py-3 text-xs text-muted">
          <span className="flex items-center gap-2"><span className="h-3.5 w-5 rounded border border-line bg-surface" /> Working</span>
          <span className="flex items-center gap-2"><span className="h-3.5 w-5 rounded border border-l-[3px] border-line border-l-accent-500 bg-surface" /> Changed for that day</span>
          <span className="flex items-center gap-2"><span className="dot-grid h-3.5 w-5 rounded border border-dashed border-line-strong bg-subtle" /> Off</span>
          <span className="flex items-center gap-2"><span className="h-3.5 w-5 rounded border border-sky-200 bg-sky-50" /> Leave</span>
          <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-ok" /> Dot = how the day actually went (hover for status)</span>
          <span className="ml-auto">Hours exclude break allowances. Past days are read-only.</span>
        </div>
      </Card>
    </>
  );
}

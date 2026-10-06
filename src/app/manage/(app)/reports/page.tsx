import { eq } from "drizzle-orm";
import { AlarmClock, CalendarDays, Clock3, Download, FileSpreadsheet, TrendingUp, UserX } from "lucide-react";
import { db } from "@/db";
import { jobRoles } from "@/db/schema";
import { Card, Chip, cx, Empty, LinkButton, PageHeader, Person, Stat, Table, Td, Th } from "@/components/ui";
import { duration, prettyDate } from "@/lib/format";
import { PERIOD_LABEL, resolvePeriod } from "@/lib/periods";
import { payrollReport, today } from "@/server/attendance";
import { requireManager } from "@/server/auth";

const h = (m: number) => (m ? duration(m) : "—");

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { business, settings } = await requireManager();
  const sp = await searchParams;
  const now = today(settings);
  const period = resolvePeriod(sp, now);
  const [report, roles] = await Promise.all([
    payrollReport(business.id, settings, period.from, period.to),
    db.select().from(jobRoles).where(eq(jobRoles.businessId, business.id)),
  ]);
  const qs = new URLSearchParams({ period: period.key, ...(period.key === "custom" ? { from: period.from, to: period.to } : {}) }).toString();
  const sum = (k: keyof (typeof report.rows)[number]) => report.rows.reduce((s, r) => s + (r[k] as number), 0);
  const future = period.from > now;

  return (
    <>
      <PageHeader
        icon={FileSpreadsheet}
        title="Payroll export"
        description={`${prettyDate(period.from)} – ${prettyDate(period.to)}${report.to < period.to && !future ? ` · counted up to today (${prettyDate(report.to)})` : ""}`}
        actions={
          <>
            <LinkButton href={`/manage/reports/export?type=daily&${qs}`} variant="secondary" prefetch={false}><Download className="h-4 w-4" /> Daily detail (CSV)</LinkButton>
            <LinkButton href={`/manage/reports/export?type=summary&${qs}`} prefetch={false}><Download className="h-4 w-4" /> Download payroll (CSV)</LinkButton>
          </>
        }
      />

      {/* Period filters */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {(Object.keys(PERIOD_LABEL) as (keyof typeof PERIOD_LABEL)[]).map((k) => (
          <Chip key={k} href={`/manage/reports?period=${k}`} active={period.key === k}>{PERIOD_LABEL[k]}</Chip>
        ))}
        <form className="flex items-center gap-2" action="/manage/reports">
          <input type="hidden" name="period" value="custom" />
          <span className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-line-strong bg-surface px-3 shadow-card">
            <CalendarDays className="h-4 w-4 text-muted" strokeWidth={1.75} />
            <input type="date" name="from" defaultValue={period.from} className="bg-transparent text-[13px] outline-none" aria-label="From" />
            <span className="text-faint">→</span>
            <input type="date" name="to" defaultValue={period.to} className="bg-transparent text-[13px] outline-none" aria-label="To" />
          </span>
          <button className={cx("h-9 rounded-[10px] px-3 text-[13px] font-medium shadow-card", period.key === "custom" ? "bg-ink text-white" : "border border-line-strong bg-surface text-ink-2 hover:bg-subtle")}>Apply</button>
        </form>
      </div>

      {future ? (
        <Card><Empty icon={CalendarDays} title="This period hasn't started yet">Pick a period that includes today or earlier.</Empty></Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat label="Hours worked" icon={Clock3} value={h(sum("minutesWorked"))} sub={`${sum("daysWorked")} days worked in total`} />
            <Stat label="Overtime" icon={TrendingUp} value={h(sum("overtimeMinutes"))} sub={`${h(sum("undertimeMinutes"))} undertime`} />
            <Stat label="Late arrivals" icon={AlarmClock} value={sum("late")} sub={`${h(sum("minutesLate"))} late in total`} />
            <Stat label="Absences" icon={UserX} value={sum("absent")} sub={`${sum("leaveDays")} leave days · ${sum("missingClockOuts")} missing clock-outs`} />
          </div>

          <Card title="Per person" description="The same numbers as the payroll download. Hours are after breaks." flush>
            <Table minWidth={1040}>
              <thead>
                <tr>
                  <Th>Staff</Th><Th>ID</Th><Th className="text-right">Sched.</Th><Th className="text-right">Worked</Th><Th className="text-right">On time</Th><Th className="text-right">Late</Th>
                  <Th className="text-right">Absent</Th><Th className="text-right">Leave</Th><Th className="text-right">Hours</Th><Th className="text-right">Overtime</Th><Th className="text-right">Under</Th><Th className="text-right">No clock-out</Th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.employee.id} className="hover:bg-subtle">
                    <Td>
                      <Person name={r.employee.fullName} href={`/manage/staff/${r.employee.id}`} />
                      <div className="ml-8 text-xs text-muted">{roles.find((x) => x.id === r.employee.roleId)?.name ?? "No role"}</div>
                    </Td>
                    <Td><span className="rounded-md border border-line-strong bg-subtle px-1.5 py-0.5 font-mono text-xs">{r.employee.staffCode}</span></Td>
                    <Td className="text-right font-mono tabular-nums">{r.scheduledDays}</Td>
                    <Td className="text-right font-mono tabular-nums">{r.daysWorked}</Td>
                    <Td className="text-right font-mono tabular-nums text-ok">{r.onTime}</Td>
                    <Td className={cx("text-right font-mono tabular-nums", r.late > 0 && "text-late")}>{r.late}</Td>
                    <Td className={cx("text-right font-mono tabular-nums", r.absent > 0 && "text-absent")}>{r.absent}</Td>
                    <Td className="text-right font-mono tabular-nums">{r.leaveDays}</Td>
                    <Td className="text-right font-mono font-semibold tabular-nums">{h(r.minutesWorked)}</Td>
                    <Td className="text-right font-mono tabular-nums text-ok">{h(r.overtimeMinutes)}</Td>
                    <Td className="text-right font-mono tabular-nums text-late">{h(r.undertimeMinutes)}</Td>
                    <Td className={cx("text-right font-mono tabular-nums", r.missingClockOuts > 0 && "text-absent")}>{r.missingClockOuts}</Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-subtle font-semibold">
                  <td className="px-5 py-3 text-[13px]" colSpan={2}>Total · {report.rows.length} staff</td>
                  {(["scheduledDays", "daysWorked", "onTime", "late", "absent", "leaveDays"] as const).map((k) => (
                    <td key={k} className="px-3 py-3 text-right font-mono text-[13px] tabular-nums">{sum(k)}</td>
                  ))}
                  <td className="px-3 py-3 text-right font-mono text-[13px] tabular-nums">{h(sum("minutesWorked"))}</td>
                  <td className="px-3 py-3 text-right font-mono text-[13px] tabular-nums">{h(sum("overtimeMinutes"))}</td>
                  <td className="px-3 py-3 text-right font-mono text-[13px] tabular-nums">{h(sum("undertimeMinutes"))}</td>
                  <td className="px-5 py-3 text-right font-mono text-[13px] tabular-nums">{sum("missingClockOuts")}</td>
                </tr>
              </tfoot>
            </Table>
          </Card>
        </>
      )}
    </>
  );
}

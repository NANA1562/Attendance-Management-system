import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { jobRoles } from "@/db/schema";
import { hrs, toCsv } from "@/lib/csv";
import { STATUS_LABEL } from "@/lib/format";
import { localTime } from "@/lib/time";
import { resolvePeriod } from "@/lib/periods";
import { audit } from "@/server/audit";
import { payrollReport, today } from "@/server/attendance";
import { currentManager } from "@/server/auth";

/** CSV download of the payroll report: ?type=summary|daily&period=…&from=…&to=… */
export async function GET(req: NextRequest) {
  const manager = await currentManager();
  if (!manager) return new Response("Unauthorized", { status: 401 });
  const { business, settings, employee: me } = manager;
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const period = resolvePeriod(sp, today(settings));
  const type = sp.type === "daily" ? "daily" : "summary";

  const [report, roles] = await Promise.all([
    payrollReport(business.id, settings, period.from, period.to),
    db.select().from(jobRoles).where(eq(jobRoles.businessId, business.id)),
  ]);
  const roleName = (id: string | null) => roles.find((r) => r.id === id)?.name ?? "";
  const tz = settings.timezone;

  const csv =
    type === "summary"
      ? toCsv([
          ["Staff ID", "Name", "Role", "Level", "Scheduled days", "Days worked", "On time", "Late", "Absent", "Leave days", "Off days worked", "Hours worked", "Overtime hours", "Undertime hours", "Break hours", "Minutes late (total)", "Missing clock-outs"],
          ...report.rows.map((r) => [
            r.employee.staffCode,
            r.employee.fullName,
            roleName(r.employee.roleId),
            r.employee.level,
            r.scheduledDays,
            r.daysWorked,
            r.onTime,
            r.late,
            r.absent,
            r.leaveDays,
            r.offDaysWorked,
            hrs(r.minutesWorked),
            hrs(r.overtimeMinutes),
            hrs(r.undertimeMinutes),
            hrs(r.breakMinutes),
            r.minutesLate,
            r.missingClockOuts,
          ]),
        ])
      : toCsv([
          ["Date", "Staff ID", "Name", "Status", "Shift start", "Shift end", "Clock in", "Clock out", "Break (min)", "Hours worked", "Overtime (min)", "Undertime (min)", "Minutes late", "Late reason", "Notes"],
          ...report.daily
            .sort((a, b) => a.workDate.localeCompare(b.workDate) || a.employee.fullName.localeCompare(b.employee.fullName))
            .map(({ employee: e, workDate, plan, result: r, lateReason }) => [
              workDate,
              e.staffCode,
              e.fullName,
              STATUS_LABEL[r.status],
              plan.kind === "working" ? plan.start : "",
              plan.kind === "working" ? plan.end : "",
              r.clockInAt ? localTime(r.clockInAt, tz) : "",
              r.clockOutAt ? localTime(r.clockOutAt, tz) : "",
              r.breakMinutes,
              r.hoursWorked === null ? "" : r.hoursWorked.toFixed(2),
              r.overtimeMinutes,
              r.undertimeMinutes,
              r.minutesLate,
              lateReason ?? "",
              [r.missingClockOut && "No clock-out", plan.kind === "working" && plan.halfDay && "Half-day leave", r.earlyLeaveMinutes > 0 && `Left ${r.earlyLeaveMinutes} min early`]
                .filter(Boolean)
                .join("; "),
            ]),
        ]);

  await audit({ businessId: business.id, employeeId: me.id, action: "payroll_exported", detail: `${type} ${period.from}..${report.to}` });

  const filename = `${business.businessCode}-${type === "summary" ? "payroll" : "attendance-daily"}-${period.from}-to-${report.to}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

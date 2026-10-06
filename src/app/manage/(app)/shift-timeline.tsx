import Link from "next/link";
import { Avatar, cx, StatusBadge } from "@/components/ui";
import { duration } from "@/lib/format";
import { localTime, minutesBetween, timeToMinutes, zonedToUtc } from "@/lib/time";
import type { DayRow } from "@/server/attendance";

/**
 * One row per person: scheduled shift as a dashed band, worked time as solid
 * violet, breaks hatched amber, and a black line for "now". Hovering a segment
 * shows its exact times. The attendance table below is the table view.
 */
export function ShiftTimeline({
  rows,
  workDate,
  timeZone,
  isToday,
  roleName,
}: {
  rows: DayRow[];
  workDate: string;
  timeZone: string;
  isToday: boolean;
  roleName: (id: string | null) => string | null;
}) {
  // People with a shift or any taps get a bar; everyone else is summarised below.
  const onBoard = rows.filter((r) => r.plan.kind === "working" || r.result.segments.length > 0);
  const offBoard = rows.filter((r) => !onBoard.includes(r));

  // Visible window: an hour either side of the earliest start / latest end.
  const toMin = (d: Date) => timeToMinutes(localTime(d, timeZone));
  let lo = 24 * 60;
  let hi = 0;
  for (const r of onBoard) {
    if (r.plan.kind === "working") {
      lo = Math.min(lo, timeToMinutes(r.plan.start));
      hi = Math.max(hi, timeToMinutes(r.plan.end));
    }
    for (const s of r.result.segments) {
      lo = Math.min(lo, toMin(s.from));
      hi = Math.max(hi, toMin(s.to));
    }
  }
  if (lo >= hi) [lo, hi] = [8 * 60, 17 * 60];
  const startH = Math.max(0, Math.floor(lo / 60) - 1);
  const endH = Math.min(24, Math.ceil(hi / 60) + 1);
  const dayStart = zonedToUtc(workDate, `${String(startH).padStart(2, "0")}:00`, timeZone);
  const span = (endH - startH) * 60;
  const pos = (d: Date) => Math.max(0, Math.min(100, (minutesBetween(dayStart, d) / span) * 100));
  const posMin = (m: number) => Math.max(0, Math.min(100, ((m - startH * 60) / span) * 100));
  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i);
  const now = new Date();
  const nowPos = isToday ? pos(now) : null;
  const step = hours.length > 12 ? 2 : 1;

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          {/* Hour axis */}
          <div className="grid grid-cols-[minmax(140px,180px)_1fr_auto] items-end gap-4 pb-2">
            <div />
            <div className="relative h-5">
              {hours.map((h, i) =>
                i % step === 0 ? (
                  <span key={h} className="absolute -translate-x-1/2 font-mono text-[11px] tabular-nums text-faint" style={{ left: `${posMin(h * 60)}%` }}>
                    {String(h).padStart(2, "0")}:00
                  </span>
                ) : null,
              )}
            </div>
            <div className="w-[140px]" />
          </div>

          <ul className="divide-y divide-line">
            {onBoard.map((r) => {
              const plan = r.plan.kind === "working" ? r.plan : null;
              const role = roleName(r.employee.roleId);
              return (
                <li key={r.employee.id} className="grid grid-cols-[minmax(140px,180px)_1fr_auto] items-center gap-4 py-3">
                  <Link href={`/manage/staff/${r.employee.id}`} className="flex min-w-0 items-center gap-3 rounded-lg hover:opacity-70">
                    <Avatar name={r.employee.fullName} />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-ink">{r.employee.fullName}</div>
                      <div className="truncate text-xs text-muted">
                        {plan ? `${plan.start}–${plan.end}` : "Unscheduled"}
                        {role && ` · ${role}`}
                      </div>
                    </div>
                  </Link>

                  <div className="relative h-10">
                    {/* hour gridlines */}
                    {hours.map((h) => (
                      <span key={h} className="absolute inset-y-0 w-px bg-line/70" style={{ left: `${posMin(h * 60)}%` }} />
                    ))}
                    {/* scheduled shift */}
                    {plan && (
                      <span
                        className="absolute inset-y-1 rounded-lg border border-dashed border-line-strong bg-subtle"
                        style={{ left: `${posMin(timeToMinutes(plan.start))}%`, width: `${posMin(timeToMinutes(plan.end)) - posMin(timeToMinutes(plan.start))}%` }}
                      />
                    )}
                    {/* worked & break segments, 2px gap between neighbours */}
                    {r.result.segments.map((s, i) => {
                      const left = pos(s.from);
                      const width = Math.max(0.6, pos(s.to) - left);
                      const label = `${s.kind === "work" ? "Worked" : "Break"} ${localTime(s.from, timeZone)}–${s.open ? "now" : localTime(s.to, timeZone)} · ${duration(minutesBetween(s.from, s.to)) || "under 1m"}`;
                      return (
                        <span
                          key={i}
                          tabIndex={0}
                          aria-label={label}
                          className="group/seg absolute top-1/2 h-4 -translate-y-1/2 outline-none"
                          style={{ left: `${left}%`, width: `calc(${width}% - 2px)` }}
                        >
                          <span
                            className={cx(
                              "block h-full rounded-[4px] transition group-hover/seg:brightness-110 group-focus/seg:ring-2 group-focus/seg:ring-accent-400",
                              s.kind === "work" ? "bg-accent-600" : "hatch-break ring-1 ring-inset ring-break/60",
                              s.open && "animate-pulse",
                            )}
                          />
                          <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold text-white shadow-pop group-hover/seg:block group-focus/seg:block">
                            {label}
                          </span>
                        </span>
                      );
                    })}
                    {nowPos !== null && nowPos > 0 && nowPos < 100 && (
                      <span className="absolute -inset-y-1 w-0.5 rounded-full bg-ink" style={{ left: `${nowPos}%` }} />
                    )}
                  </div>

                  <div className="flex w-[140px] flex-col items-start gap-1">
                    <StatusBadge status={r.result.status} />
                    {r.result.state === "on_break" && <span className="text-[11px] font-semibold text-late">On break</span>}
                    {r.result.missingClockOut && <span className="text-[11px] font-semibold text-absent">No clock-out</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-xs text-muted">
        <span className="flex items-center gap-2"><span className="h-3 w-6 rounded border border-dashed border-line-strong bg-subtle" /> Scheduled</span>
        <span className="flex items-center gap-2"><span className="h-3 w-6 rounded-[4px] bg-accent-600" /> Worked</span>
        <span className="flex items-center gap-2"><span className="hatch-break h-3 w-6 rounded-[4px] ring-1 ring-inset ring-break/60" /> Break</span>
        {isToday && <span className="flex items-center gap-2"><span className="h-3 w-0.5 rounded-full bg-ink" /> Now</span>}
        {offBoard.length > 0 && (
          <span className="ml-auto text-muted">
            Off or on leave: {offBoard.map((r) => r.employee.fullName.split(" ")[0]).join(", ")}
          </span>
        )}
      </div>
    </div>
  );
}

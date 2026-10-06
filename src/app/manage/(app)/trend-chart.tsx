import { prettyDate } from "@/lib/format";
import type { DaySummary } from "@/server/attendance";

/** Smooth path through points (Catmull-Rom → cubic Bézier), in a 0–100 box. */
function smooth(points: [number, number][]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0][0]},${points[0][1]}`;
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${Math.max(0, Math.min(100, c1[1]))} ${c2[0]},${Math.max(0, Math.min(100, c2[1]))} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/**
 * Attendance rate per working day. One series, so the title names it and
 * there's no legend box; every day has a hover tooltip with the exact counts.
 */
export function TrendChart({ days, metric }: { days: DaySummary[]; metric: "present" | "ontime" }) {
  const work = days.filter((d) => d.scheduled > 0);
  if (work.length === 0) return <div className="flex h-56 items-center justify-center text-[13px] text-muted">No scheduled days in this range yet.</div>;

  const rate = (d: DaySummary) => Math.round(((metric === "present" ? d.present : d.onTime) / d.scheduled) * 100);
  const x = (i: number) => (work.length === 1 ? 50 : (i / (work.length - 1)) * 100);
  const y = (pct: number) => 100 - Math.min(100, pct);
  const pts = work.map((d, i) => [x(i), y(rate(d))] as [number, number]);
  const line = smooth(pts);
  const area = `${line} L100,100 L0,100 Z`;
  const labelEvery = Math.ceil(work.length / 7);

  return (
    <div>
      <div className="flex">
        {/* y axis */}
        <div className="relative mr-3 h-56 w-9 shrink-0 text-right font-mono text-[11px] text-faint">
          {[100, 75, 50, 25, 0].map((v) => (
            <span key={v} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - v}%` }}>{v}%</span>
          ))}
        </div>

        <div className="relative h-56 flex-1">
          {/* gridlines */}
          {[0, 25, 50, 75, 100].map((v) => (
            <span key={v} className="absolute inset-x-0 border-t border-dashed border-line-strong" style={{ top: `${100 - v}%` }} />
          ))}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            <defs>
              <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#trend-fill)" />
            <path d={line} fill="none" stroke="#7c3aed" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          </svg>

          {/* hover columns: crosshair, dot and tooltip per day */}
          <div className="absolute inset-0 flex">
            {work.map((d, i) => {
              const left = x(i);
              const width = work.length === 1 ? 100 : 100 / (work.length - 1);
              return (
                <div
                  key={d.date}
                  tabIndex={0}
                  className="group/pt absolute inset-y-0 outline-none"
                  style={{ left: `${Math.max(0, left - width / 2)}%`, width: `${width}%` }}
                  aria-label={`${prettyDate(d.date)}: ${rate(d)}%`}
                >
                  <span className="pointer-events-none absolute inset-y-0 hidden w-px bg-line-strong group-hover/pt:block group-focus/pt:block" style={{ left: `${((left - Math.max(0, left - width / 2)) / width) * 100}%` }} />
                  <span
                    className="pointer-events-none absolute hidden h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent-600 shadow-card group-hover/pt:block group-focus/pt:block"
                    style={{ left: `${((left - Math.max(0, left - width / 2)) / width) * 100}%`, top: `${y(rate(d))}%` }}
                  />
                  <span
                    className="pointer-events-none absolute z-10 hidden w-44 -translate-x-1/2 rounded-xl border border-line bg-surface p-3 text-xs shadow-pop group-hover/pt:block group-focus/pt:block"
                    style={{ left: `${Math.min(80, Math.max(20, ((left - Math.max(0, left - width / 2)) / width) * 100))}%`, top: `${Math.max(0, y(rate(d)) - 48)}%` }}
                  >
                    <span className="block font-medium text-ink">{prettyDate(d.date)}</span>
                    <span className="mt-1.5 flex justify-between text-muted">Present <b className="font-medium text-ink tabular-nums">{d.present}/{d.scheduled}</b></span>
                    <span className="flex justify-between text-muted">On time <b className="font-medium text-ink tabular-nums">{d.onTime}</b></span>
                    <span className="flex justify-between text-muted">Late <b className="font-medium text-ink tabular-nums">{d.late}</b></span>
                    <span className="flex justify-between text-muted">Absent <b className="font-medium text-ink tabular-nums">{d.absent}</b></span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* x axis */}
      <div className="relative ml-12 mt-3 h-4 font-mono text-[11px] text-faint">
        {work.map((d, i) =>
          i % labelEvery === 0 || i === work.length - 1 ? (
            <span key={d.date} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${x(i)}%` }}>
              {prettyDate(d.date).slice(4)}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

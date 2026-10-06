"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { Loader2, RotateCcw, X } from "lucide-react";
import type { ActionState } from "@/components/action-form";
import { cx } from "@/components/ui";
import { saveDayShift } from "../../actions";

export interface CellView {
  employeeId: string;
  employeeName: string;
  date: string;
  dateLabel: string;
  kind: "working" | "off" | "leave";
  start: string | null;
  end: string | null;
  breakMinutes: number;
  override: boolean;
  halfDay: boolean;
  editable: boolean;
  isToday: boolean;
  /** Dot colour class for what actually happened (past / today), if anything. */
  statusDot: string | null;
  statusLabel: string | null;
}

/** One rota cell. Click to change that single day without touching the weekly pattern. */
export function RotaCell({ cell }: { cell: CellView }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"work" | "off">(cell.kind === "off" ? "off" : "work");
  const [state, action, pending] = useActionState(saveDayShift, null as ActionState);

  // Close the editor once a save succeeds.
  useEffect(() => {
    if (state?.ok) startTransition(() => setOpen(false));
  }, [state]);

  const submit = (data: FormData) => startTransition(() => action(data));

  return (
    <div className="relative">
      <button
        type="button"
        disabled={!cell.editable}
        onClick={() => setOpen((o) => !o)}
        title={cell.statusLabel ?? undefined}
        className={cx(
          "group flex h-14 w-full flex-col justify-center rounded-[10px] border px-2 text-left transition",
          cell.kind === "working" && "border-line bg-surface hover:border-line-strong hover:shadow-card",
          cell.kind === "off" && "dot-grid border-dashed border-line-strong bg-subtle",
          cell.kind === "leave" && "border-sky-200 bg-sky-50",
          cell.override && "border-l-[3px] border-l-accent-500",
          cell.isToday && "ring-2 ring-accent-200",
          !cell.editable && "cursor-default",
          open && "border-ink shadow-pop",
        )}
      >
        <span className="flex items-center justify-between gap-1">
          <span className={cx("whitespace-nowrap text-[12.5px] font-medium tabular-nums tracking-tight", cell.kind === "working" ? "text-ink" : cell.kind === "leave" ? "text-sky-700" : "text-faint")}>
            {cell.kind === "working" ? `${cell.start}–${cell.end}` : cell.kind === "leave" ? "Leave" : "Off"}
          </span>
          {cell.statusDot && <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", cell.statusDot)} />}
        </span>
        <span className="truncate text-[11px] text-muted">
          {cell.kind === "working" ? (cell.halfDay ? "Half day" : cell.override ? "Changed" : `${cell.breakMinutes}m break`) : cell.override ? "Changed" : " "}
        </span>
      </button>

      {open && (
        <>
          <button type="button" aria-label="Close" className="fixed inset-0 z-40 cursor-default bg-ink/20 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <form
            action={submit}
            role="dialog"
            aria-label={`Change ${cell.employeeName}'s shift on ${cell.dateLabel}`}
            className="fixed left-1/2 top-1/2 z-50 w-[300px] -translate-x-1/2 -translate-y-1/2 animate-fade-up rounded-[18px] border border-line bg-subtle p-[3px] shadow-pop"
          >
            <div className="rounded-[13px] border border-line bg-surface p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[13px] font-semibold">{cell.employeeName}</div>
                  <div className="text-xs text-muted">{cell.dateLabel} only</div>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-muted hover:bg-sunken"><X className="h-4 w-4" /></button>
              </div>
              <input type="hidden" name="employeeId" value={cell.employeeId} />
              <input type="hidden" name="date" value={cell.date} />
              <input type="hidden" name="mode" value={mode} />

              <div className="mt-3 grid grid-cols-2 rounded-[10px] bg-sunken p-0.5 text-[13px]">
                {(["work", "off"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={cx("rounded-lg py-1 font-medium", mode === m ? "bg-surface shadow-card" : "text-muted")}
                  >
                    {m === "work" ? "Working" : "Day off"}
                  </button>
                ))}
              </div>

              {mode === "work" && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="text-xs text-muted">Start
                    <input type="time" name="start" defaultValue={cell.start ?? "08:00"} className="mt-1 h-9 w-full rounded-[10px] border border-line-strong px-2 text-[13px] text-ink" />
                  </label>
                  <label className="text-xs text-muted">End
                    <input type="time" name="end" defaultValue={cell.end ?? "17:00"} className="mt-1 h-9 w-full rounded-[10px] border border-line-strong px-2 text-[13px] text-ink" />
                  </label>
                  <label className="col-span-2 text-xs text-muted">Break (minutes)
                    <input type="number" name="breakMinutes" min={0} max={240} defaultValue={cell.breakMinutes} className="mt-1 h-9 w-full rounded-[10px] border border-line-strong px-2 text-[13px] text-ink" />
                  </label>
                </div>
              )}

              {state?.error && <p className="mt-2 text-xs font-medium text-red-600">{state.error}</p>}

              <div className="mt-3 flex items-center gap-2">
                <button type="submit" disabled={pending} className="flex h-9 flex-1 items-center justify-center gap-2 rounded-[10px] bg-ink text-[13px] font-medium text-white disabled:opacity-60">
                  {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
                </button>
                {cell.override && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const data = new FormData();
                      data.set("employeeId", cell.employeeId);
                      data.set("date", cell.date);
                      data.set("mode", "reset");
                      submit(data);
                    }}
                    title="Go back to their usual weekly pattern"
                    className="flex h-9 items-center gap-1.5 rounded-[10px] border border-line-strong px-2.5 text-[13px] font-medium text-ink-2 hover:bg-subtle"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Usual
                  </button>
                )}
              </div>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

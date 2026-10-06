import { MonitorSmartphone, Ruler } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { FormButton } from "@/components/form-button";
import { Card, Field, Input, PageHeader, STATUS_STYLE } from "@/components/ui";
import type { LiveStatus } from "@/lib/attendance/engine";
import { STATUS_LABEL } from "@/lib/format";
import { requireManager } from "@/server/auth";
import { resetTablet, saveSettings } from "../../actions";

export default async function SettingsPage() {
  const { business, settings: s } = await requireManager();

  // The arrival scale, drawn to proportion up to the absent cutoff.
  const total = s.absentAfterMinutes;
  const bands: { status: LiveStatus; from: number; to: number; label: string }[] = [
    { status: "grace", from: 0, to: s.graceMinutes, label: `1–${s.graceMinutes} min` },
    { status: "late", from: s.graceMinutes, to: s.lateUntilMinutes, label: `${s.graceMinutes + 1}–${s.lateUntilMinutes} min` },
    { status: "attendance_risk", from: s.lateUntilMinutes, to: s.absentAfterMinutes, label: `${s.lateUntilMinutes + 1}+ min` },
  ];

  return (
    <>
      <PageHeader eyebrow="Business" title="Settings" description="Rules for this business. Changes apply to how every day is worked out, including past days." />
      <div className="grid max-w-4xl gap-6">
        <Card title={<span className="flex items-center gap-2"><Ruler className="h-4 w-4 text-gold-600" /> Arrival rules</span>} description="Measured from each person's scheduled start time.">
          {/* Visual scale */}
          <div className="mb-8 rounded-xl bg-canvas p-5">
            <div className="flex h-10 gap-0.5 overflow-hidden rounded-lg">
              <div className="flex w-14 shrink-0 items-center justify-center bg-forest-500 text-[11px] font-bold text-white">START</div>
              {bands.map((b) => (
                <div
                  key={b.status}
                  className={`flex items-center justify-center text-[11px] font-bold ${STATUS_STYLE[b.status].dot} text-white`}
                  style={{ width: `${((b.to - b.from) / total) * 100}%` }}
                />
              ))}
              <div className="flex w-20 shrink-0 items-center justify-center bg-absent text-[11px] font-bold text-white">ABSENT</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
              <span className="flex items-center gap-1.5 font-semibold"><span className="h-2.5 w-2.5 rounded-full bg-ok" /> {STATUS_LABEL.on_time}: on or before start</span>
              {bands.map((b) => (
                <span key={b.status} className="flex items-center gap-1.5 font-semibold">
                  <span className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLE[b.status].dot}`} /> {STATUS_LABEL[b.status]}: {b.label}
                </span>
              ))}
              <span className="flex items-center gap-1.5 font-semibold"><span className="h-2.5 w-2.5 rounded-full bg-absent" /> Absent: no clock-in by {s.absentAfterMinutes} min</span>
            </div>
          </div>

          <ActionForm action={saveSettings} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Grace until (min)" hint="Up to this = Grace"><Input type="number" name="graceMinutes" defaultValue={s.graceMinutes} min={0} required /></Field>
              <Field label="Late until (min)" hint="Up to this = Late"><Input type="number" name="lateUntilMinutes" defaultValue={s.lateUntilMinutes} min={0} required /></Field>
              <Field label="Absent after (min)" hint="No clock-in by then = Absent"><Input type="number" name="absentAfterMinutes" defaultValue={s.absentAfterMinutes} min={0} required /></Field>
            </div>
            <div className="border-t border-line pt-5">
              <div className="mb-3 text-sm font-bold">Breaks, security and time</div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Default break (min)" hint="Pre-filled on new schedules"><Input type="number" name="defaultBreakMinutes" defaultValue={s.defaultBreakMinutes} min={0} required /></Field>
                <Field label="Lock after (wrong PINs)"><Input type="number" name="lockoutAttempts" defaultValue={s.lockoutAttempts} min={1} required /></Field>
                <Field label="Lock for (min)"><Input type="number" name="lockoutMinutes" defaultValue={s.lockoutMinutes} min={1} required /></Field>
              </div>
              <Field label="Timezone" hint="e.g. Africa/Accra, Africa/Lagos, Europe/London" className="mt-4 max-w-xs"><Input name="timezone" defaultValue={s.timezone} required /></Field>
            </div>
            <SubmitButton>Save settings</SubmitButton>
          </ActionForm>
        </Card>

        <Card title={<span className="flex items-center gap-2"><MonitorSmartphone className="h-4 w-4 text-gold-600" /> Clock-in tablet</span>}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm text-ink-2">Business code, entered once on the tablet</div>
              <div className="mt-1 font-mono text-3xl font-bold tracking-[0.3em] text-forest-800">{business.businessCode}</div>
            </div>
            <form action={resetTablet}>
              <FormButton variant="secondary">Disconnect tablet on this device</FormButton>
            </form>
          </div>
        </Card>
      </div>
    </>
  );
}

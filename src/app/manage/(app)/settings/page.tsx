import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button, Card, Field, Input } from "@/components/ui";
import { requireManager } from "@/server/auth";
import { resetTablet, saveSettings } from "../../actions";

export default async function SettingsPage() {
  const { business, settings: s } = await requireManager();
  return (
    <div className="grid max-w-3xl gap-6">
      <Card title="Attendance rules">
        <ActionForm action={saveSettings} className="space-y-5">
          <p className="text-sm text-stone-600">Measured from the scheduled start time. Clocking in after the late window counts as attendance risk; never clocking in by the absent cutoff counts as absent.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Grace until (min)" hint="1 to this = Grace"><Input type="number" name="graceMinutes" defaultValue={s.graceMinutes} min={0} required /></Field>
            <Field label="Late until (min)" hint="After grace up to this = Late"><Input type="number" name="lateUntilMinutes" defaultValue={s.lateUntilMinutes} min={0} required /></Field>
            <Field label="Absent after (min)" hint="No clock-in by now = Absent"><Input type="number" name="absentAfterMinutes" defaultValue={s.absentAfterMinutes} min={0} required /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Default break (min)" hint="Pre-filled on new schedules"><Input type="number" name="defaultBreakMinutes" defaultValue={s.defaultBreakMinutes} min={0} required /></Field>
            <Field label="Lockout after (tries)"><Input type="number" name="lockoutAttempts" defaultValue={s.lockoutAttempts} min={1} required /></Field>
            <Field label="Lockout for (min)"><Input type="number" name="lockoutMinutes" defaultValue={s.lockoutMinutes} min={1} required /></Field>
          </div>
          <Field label="Timezone" hint="e.g. Africa/Accra, Africa/Lagos, Europe/London"><Input name="timezone" defaultValue={s.timezone} required className="max-w-xs" /></Field>
          <SubmitButton>Save settings</SubmitButton>
        </ActionForm>
      </Card>

      <Card title="Tablet">
        <p className="text-sm text-stone-600">
          Business code: <span className="font-mono font-semibold">{business.businessCode}</span>. Enter it on the clock-in tablet once.
        </p>
        <form action={resetTablet} className="mt-4">
          <Button variant="secondary">Disconnect the tablet on this device</Button>
        </form>
      </Card>
    </div>
  );
}

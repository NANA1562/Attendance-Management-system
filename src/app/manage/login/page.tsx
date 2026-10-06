import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AuthShell } from "@/components/auth-shell";
import { Field, Input } from "@/components/ui";
import { getKiosk } from "@/server/auth";
import { managerLogin } from "./actions";

export default async function ManagerLoginPage() {
  const kiosk = await getKiosk();
  return (
    <AuthShell eyebrow="Senior staff" title="Welcome back" description="Sign in to see today's attendance and tasks.">
      <ActionForm action={managerLogin} className="space-y-4">
        <Field label="Business code">
          <Input name="businessCode" defaultValue={kiosk?.business.businessCode} autoCapitalize="characters" required className="font-mono uppercase tracking-[0.2em]" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Staff ID"><Input name="staffCode" inputMode="numeric" required /></Field>
          <Field label="PIN"><Input name="pin" type="password" inputMode="numeric" maxLength={4} required /></Field>
        </div>
        <Field label="Dashboard password"><Input name="password" type="password" required /></Field>
        <SubmitButton pendingLabel="Signing in…" className="h-12 w-full text-base">Sign in</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-ink-2">
        New to the app? <Link href="/setup" className="font-semibold text-forest-700 hover:underline">Create a business</Link>
      </p>
    </AuthShell>
  );
}

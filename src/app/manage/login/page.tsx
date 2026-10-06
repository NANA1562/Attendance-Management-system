import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Field, Input } from "@/components/ui";
import { getKiosk } from "@/server/auth";
import { managerLogin } from "./actions";

export default async function ManagerLoginPage() {
  const kiosk = await getKiosk();
  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <Link href="/" className="text-sm text-stone-500">← Back</Link>
      <h1 className="mt-4 text-2xl font-semibold">Manager login</h1>
      <Card className="mt-6">
        <ActionForm action={managerLogin} className="space-y-4">
              <Field label="Business code">
                <Input name="businessCode" defaultValue={kiosk?.business.businessCode} autoCapitalize="characters" required />
              </Field>
              <Field label="Staff ID"><Input name="staffCode" inputMode="numeric" required /></Field>
              <Field label="PIN"><Input name="pin" type="password" inputMode="numeric" maxLength={4} required /></Field>
              <Field label="Password"><Input name="password" type="password" required /></Field>
              <SubmitButton pendingLabel="Checking…" className="w-full py-3">Log in</SubmitButton>
        </ActionForm>
      </Card>
      <p className="mt-4 text-center text-sm text-stone-500">
        New here? <Link href="/setup" className="underline">Create a business</Link>
      </p>
    </main>
  );
}

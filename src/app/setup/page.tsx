import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Field, Input } from "@/components/ui";
import { createBusiness } from "./actions";

export default function SetupPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <Link href="/" className="text-sm text-stone-500">← Back</Link>
      <h1 className="mt-4 text-2xl font-semibold">Create a business</h1>
      <p className="mt-1 text-sm text-stone-600">You become the first senior. Your staff ID will be 1001.</p>
      <Card className="mt-6">
        <ActionForm action={createBusiness} className="space-y-4">
              <Field label="Business name"><Input name="businessName" required /></Field>
              <Field label="Business phone (optional)"><Input name="phone" type="tel" /></Field>
              <Field label="Your full name"><Input name="fullName" required /></Field>
              <Field label="Your 4-digit PIN" hint="For clocking in on the tablet.">
                <Input name="pin" inputMode="numeric" pattern="\d{4}" maxLength={4} required />
              </Field>
              <Field label="Dashboard password" hint="At least 8 characters. Needed to open the manager dashboard.">
                <Input name="password" type="password" minLength={8} required />
              </Field>
              <SubmitButton pendingLabel="Creating…" className="w-full py-3">Create business</SubmitButton>
        </ActionForm>
      </Card>
    </main>
  );
}

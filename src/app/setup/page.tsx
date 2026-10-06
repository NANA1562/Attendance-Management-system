import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AuthShell } from "@/components/auth-shell";
import { Field, Input } from "@/components/ui";
import { createBusiness } from "./actions";

export default function SetupPage() {
  return (
    <AuthShell eyebrow="Get started" title="Create your business" description="Takes a minute. You become the first senior, with staff ID 1001.">
      <ActionForm action={createBusiness} className="space-y-4">
        <Field label="Business name"><Input name="businessName" placeholder="e.g. Pilot Retail Shop" required /></Field>
        <Field label="Business phone (optional)"><Input name="phone" type="tel" /></Field>
        <div className="my-2 border-t border-line" />
        <Field label="Your full name"><Input name="fullName" required /></Field>
        <div className="grid grid-cols-[120px_1fr] gap-3">
          <Field label="4-digit PIN"><Input name="pin" inputMode="numeric" pattern="\d{4}" maxLength={4} required className="font-mono tracking-[0.3em]" /></Field>
          <Field label="Dashboard password" hint="At least 8 characters."><Input name="password" type="password" minLength={8} required /></Field>
        </div>
        <SubmitButton pendingLabel="Creating…" className="h-12 w-full text-base">Create business</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-ink-2">
        Already set up? <Link href="/manage/login" className="font-semibold text-forest-700 hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}

import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Field, Input } from "@/components/ui";
import { getKiosk } from "@/server/auth";
import { registerTablet } from "./actions";
import { Clock } from "./clock";
import { Keypad } from "./keypad";

export default async function KioskPage() {
  const kiosk = await getKiosk();

  if (!kiosk) {
    return (
      <main className="mx-auto max-w-md px-6 py-12">
        <Link href="/" className="text-sm text-stone-500">← Back</Link>
        <h1 className="mt-4 text-2xl font-semibold">Set up this tablet</h1>
        <p className="mt-1 text-sm text-stone-600">Enter your business code once. The tablet remembers it.</p>
        <Card className="mt-6">
          <ActionForm action={registerTablet} className="space-y-4">
            <Field label="Business code"><Input name="businessCode" autoCapitalize="characters" required /></Field>
            <SubmitButton pendingLabel="Checking…" className="w-full py-3">Use this tablet</SubmitButton>
          </ActionForm>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col px-6 py-8">
      <header className="flex items-start justify-between">
        <div className="text-lg font-semibold">{kiosk.business.name}</div>
        <Clock timeZone={kiosk.settings.timezone} />
      </header>
      <div className="flex flex-1 items-center">
        <Keypad />
      </div>
    </main>
  );
}

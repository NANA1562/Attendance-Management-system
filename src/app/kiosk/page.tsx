import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Logo } from "@/components/brand";
import { Card, Eyebrow, Field, Input } from "@/components/ui";
import { getKiosk } from "@/server/auth";
import { registerTablet } from "./actions";
import { Clock } from "./clock";
import { Keypad } from "./keypad";

export default async function KioskPage() {
  const kiosk = await getKiosk();

  if (!kiosk) {
    return (
      <main className="dot-grid flex min-h-screen flex-col px-6 py-6">
        <Link href="/"><Logo /></Link>
        <div className="flex flex-1 items-center justify-center">
          <Card className="w-full max-w-md animate-fade-up" bodyClassName="p-7">
            <Eyebrow>One-time setup</Eyebrow>
            <h1 className="mt-2 text-[26px] font-semibold tracking-tight">Set up this tablet</h1>
            <p className="mt-1.5 text-[14px] text-muted">Enter your business code. The tablet remembers it, and staff clock in here from now on.</p>
            <ActionForm action={registerTablet} className="mt-6 space-y-4">
              <Field label="Business code" hint="It's in the manager dashboard sidebar.">
                <Input name="businessCode" autoCapitalize="characters" required className="h-12 font-mono text-lg uppercase tracking-[0.3em]" />
              </Field>
              <SubmitButton pendingLabel="Checking…" className="h-11 w-full">Use this tablet</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="dot-grid flex min-h-screen flex-col px-6 py-5 sm:px-10">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="hidden h-5 w-px bg-line-strong sm:block" />
          <span className="hidden text-[14px] font-medium text-ink-2 sm:block">{kiosk.business.name}</span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 py-1 text-xs font-medium text-ink-2 shadow-card">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" /> Clock-in station
        </span>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-10 py-8 lg:flex-row lg:justify-between">
        <div className="text-center lg:text-left">
          <Clock timeZone={kiosk.settings.timezone} size="xl" />
          <p className="mx-auto mt-8 hidden max-w-sm text-[16px] leading-relaxed text-ink-2 lg:mx-0 lg:block">
            Clock in, take your break and clock out here. Enter your staff ID, then your 4-digit PIN.
          </p>
        </div>
        <Keypad />
      </div>

      <footer className="flex items-center justify-center gap-1.5 text-xs text-muted"><ShieldCheck className="h-3.5 w-3.5" /> Your PIN is private. Never share it with anyone.</footer>
    </main>
  );
}

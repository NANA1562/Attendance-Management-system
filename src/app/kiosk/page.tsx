import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Logo } from "@/components/brand";
import { Field, Input } from "@/components/ui";
import { getKiosk } from "@/server/auth";
import { registerTablet } from "./actions";
import { Clock } from "./clock";
import { Keypad } from "./keypad";

export default async function KioskPage() {
  const kiosk = await getKiosk();

  if (!kiosk) {
    return (
      <main className="brand-texture flex min-h-screen flex-col bg-forest-950 px-6 py-8 text-white">
        <Link href="/"><Logo tone="light" /></Link>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md animate-fade-up rounded-3xl bg-surface p-8 text-ink shadow-lift">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-gold-600">One-time setup</div>
            <h1 className="mt-1 font-display text-3xl font-semibold">Set up this tablet</h1>
            <p className="mt-2 text-sm text-ink-2">Enter your business code. The tablet remembers it, and your staff clock in here from now on.</p>
            <ActionForm action={registerTablet} className="mt-6 space-y-4">
              <Field label="Business code" hint="Find it in the manager dashboard sidebar.">
                <Input name="businessCode" autoCapitalize="characters" required className="h-14 font-mono text-xl tracking-[0.3em] uppercase" />
              </Field>
              <SubmitButton pendingLabel="Checking…" className="h-12 w-full text-base">Use this tablet</SubmitButton>
            </ActionForm>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="brand-texture flex min-h-screen flex-col bg-forest-950 px-6 py-6 text-white sm:px-10">
      <header className="flex items-center justify-between gap-4">
        <Logo tone="light" />
        <span className="rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-forest-100">{kiosk.business.name}</span>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-10 py-8 lg:flex-row lg:justify-between lg:px-6">
        <div className="text-center lg:max-w-md lg:text-left">
          <Clock timeZone={kiosk.settings.timezone} size="xl" />
          <p className="mt-6 hidden max-w-sm text-lg text-forest-100 lg:block">
            Clock in, take your break and clock out here. Enter your staff ID, then your 4-digit PIN.
          </p>
        </div>
        <Keypad />
      </div>

      <footer className="text-center text-xs text-forest-200/70">Your PIN is private. Never share it with anyone.</footer>
    </main>
  );
}

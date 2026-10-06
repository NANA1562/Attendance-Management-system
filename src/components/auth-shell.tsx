import Link from "next/link";
import type { ReactNode } from "react";
import { CheckCircle2, Clock3, ListChecks, ShieldCheck } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { Logo } from "./brand";

const POINTS = [
  { icon: Clock3, text: "Staff clock in on one shared tablet with an ID and PIN" },
  { icon: CheckCircle2, text: "Late, absent and overtime worked out automatically" },
  { icon: ListChecks, text: "Daily tasks for every role, ticked off as they go" },
  { icon: ShieldCheck, text: "Each business completely separate and private" },
];

/** Split layout for sign-in and setup pages: brand panel left, form right. */
export function AuthShell({ title, eyebrow, description, children, back = "/" }: { title: string; eyebrow?: string; description?: ReactNode; children: ReactNode; back?: string | null }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="brand-texture relative hidden flex-col justify-between overflow-hidden bg-forest-900 p-12 text-white lg:flex">
        <Link href="/"><Logo tone="light" /></Link>
        <div>
          <h2 className="max-w-md font-display text-5xl font-semibold leading-[1.05] tracking-tight">
            Know who's in. <span className="text-gold-400">Know what's done.</span>
          </h2>
          <ul className="mt-10 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-forest-100">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-gold-400"><Icon className="h-[18px] w-[18px]" /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <div className="text-sm text-forest-200">{BRAND.tagline}</div>
      </aside>

      <section className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between lg:justify-end">
          <Link href="/" className="lg:hidden"><Logo /></Link>
          {back && <Link href={back} className="text-sm font-semibold text-ink-2 hover:text-ink">← Back</Link>}
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md animate-fade-up">
            {eyebrow && <div className="text-xs font-bold uppercase tracking-[0.14em] text-gold-600">{eyebrow}</div>}
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="mt-2 text-ink-2">{description}</p>}
            <div className="mt-8">{children}</div>
          </div>
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { AlarmClock, CircleCheckBig, UserCheck } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { Logo } from "./brand";
import { Avatar, Eyebrow, Ring } from "./ui";

/** Decorative, static preview of the dashboard for the sign-in pages. */
function Preview() {
  const rows: [string, number][] = [["Kofi Adjei", 92], ["Ama Asante", 86], ["Yaw Mensah", 78]];
  return (
    <div className="w-full max-w-md space-y-3" aria-hidden>
      <div className="grid grid-cols-3 gap-2.5">
        {[
          [UserCheck, "Present", "12/14"],
          [CircleCheckBig, "On time", "11"],
          [AlarmClock, "Late", "1"],
        ].map(([Icon, label, value]) => {
          const I = Icon as typeof UserCheck;
          return (
            <div key={label as string} className="rounded-[16px] border border-line bg-subtle p-[3px]">
              <div className="rounded-[13px] border border-line bg-surface p-3 shadow-card">
                <div className="flex items-center gap-1.5 text-xs text-muted"><I className="h-3.5 w-3.5" /> {label as string}</div>
                <div className="mt-1.5 text-xl font-semibold tracking-tight">{value as string}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="rounded-[16px] border border-line bg-subtle p-[3px]">
        <div className="rounded-[13px] border border-line bg-surface shadow-card">
          <div className="border-b border-line px-4 py-3 text-[13px] font-semibold">Punctuality leaderboard</div>
          {rows.map(([name, pct], i) => (
            <div key={name} className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-[13px] last:border-0">
              <span className="w-4 font-mono text-muted">{i + 1}</span>
              <Avatar name={name} size="sm" />
              <span className="flex-1 font-medium">{name}</span>
              <Ring value={pct} max={100} size={14} stroke={2.5} bar="stroke-ok" />
              <span className="tabular-nums">{pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Split layout for sign-in and setup pages: form left, product preview right. */
export function AuthShell({ title, eyebrow, description, children, back = "/" }: { title: string; eyebrow?: string; description?: ReactNode; children: ReactNode; back?: string | null }) {
  return (
    <main className="grid min-h-screen bg-surface lg:grid-cols-2">
      <section className="flex flex-col px-6 py-6 sm:px-12">
        <div className="flex items-center justify-between">
          <Link href="/"><Logo /></Link>
          {back && <Link href={back} className="text-[13px] font-medium text-muted hover:text-ink">← Back</Link>}
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm animate-fade-up">
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
            <h1 className="mt-2 text-[28px] font-semibold tracking-tight">{title}</h1>
            {description && <p className="mt-1.5 text-[14px] text-muted">{description}</p>}
            <div className="mt-7">{children}</div>
          </div>
        </div>
        <div className="text-xs text-faint">{BRAND.tagline}</div>
      </section>

      <aside className="hidden p-3 lg:block">
        <div className="dot-grid flex h-full flex-col items-center justify-center gap-8 rounded-[24px] border border-line bg-canvas p-12">
          <div className="max-w-md text-center">
            <h2 className="text-[32px] font-semibold leading-[1.1] tracking-tight">Know who's in.<br /><span className="text-muted">Know what's done.</span></h2>
            <p className="mt-3 text-[14px] text-muted">Staff clock in on one shared tablet. You see attendance, lateness, hours and daily tasks, worked out automatically.</p>
          </div>
          <Preview />
        </div>
      </aside>
    </main>
  );
}

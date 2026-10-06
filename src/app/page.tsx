import Link from "next/link";
import { ArrowRight, Building2, LayoutGrid, MonitorSmartphone } from "lucide-react";
import { Logo } from "@/components/brand";
import { Eyebrow } from "@/components/ui";
import { BRAND } from "@/lib/brand";

const DOORS = [
  { href: "/kiosk", icon: MonitorSmartphone, title: "Clock-in tablet", text: "For the shared tablet at the entrance.", primary: true },
  { href: "/manage/login", icon: LayoutGrid, title: "Manager dashboard", text: "See who's in and what's done." },
  { href: "/setup", icon: Building2, title: "Create a business", text: "New here? Set up in a minute." },
];

export default function Home() {
  return (
    <main className="dot-grid flex min-h-screen flex-col px-6 py-6 sm:px-12">
      <Logo />
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center py-12 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-3 py-1 shadow-card">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-600" />
          <Eyebrow className="text-ink-2">{BRAND.tagline}</Eyebrow>
        </span>
        <h1 className="mt-6 text-[44px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[64px]">
          Know who's in.<br /><span className="text-muted">Know what's done.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[16px] text-ink-2">
          Staff clock in on one shared tablet. Managers see attendance, lateness, hours and daily tasks, worked out automatically.
        </p>
        <div className="mt-10 grid w-full gap-3 text-left md:grid-cols-3">
          {DOORS.map(({ href, icon: Icon, title, text, primary }) => (
            <Link key={href} href={href} className="group rounded-[18px] border border-line bg-subtle p-[3px] transition hover:-translate-y-0.5">
              <span className={primary ? "flex h-full flex-col rounded-[15px] bg-ink p-5 text-white shadow-pop" : "flex h-full flex-col rounded-[15px] border border-line bg-surface p-5 shadow-card"}>
                <span className={primary ? "flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/10" : "flex h-9 w-9 items-center justify-center rounded-[10px] border border-line-strong bg-subtle"}>
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </span>
                <span className="mt-6 flex items-center justify-between text-[15px] font-semibold">
                  {title} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
                <span className={primary ? "mt-1 text-[13px] text-white/70" : "mt-1 text-[13px] text-muted"}>{text}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

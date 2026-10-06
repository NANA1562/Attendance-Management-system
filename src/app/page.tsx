import Link from "next/link";
import { ArrowRight, Building2, LayoutDashboard, MonitorSmartphone } from "lucide-react";
import { Logo } from "@/components/brand";
import { BRAND } from "@/lib/brand";

const DOORS = [
  { href: "/kiosk", icon: MonitorSmartphone, title: "Clock-in tablet", text: "For the shared tablet at the entrance.", primary: true },
  { href: "/manage/login", icon: LayoutDashboard, title: "Manager dashboard", text: "See who's in and what's done." },
  { href: "/setup", icon: Building2, title: "Create a business", text: "New here? Set up in a minute." },
];

export default function Home() {
  return (
    <main className="brand-texture flex min-h-screen flex-col bg-forest-950 px-6 py-8 text-white sm:px-12">
      <Logo tone="light" />
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center py-12">
        <div className="text-sm font-bold uppercase tracking-[0.16em] text-gold-400">{BRAND.tagline}</div>
        <h1 className="mt-3 max-w-3xl font-display text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl">
          Know who's in.<br /><span className="text-gold-400">Know what's done.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-forest-100">
          Staff clock in on one shared tablet. Managers see attendance, lateness, hours and daily tasks, worked out automatically.
        </p>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {DOORS.map(({ href, icon: Icon, title, text, primary }) => (
            <Link
              key={href}
              href={href}
              className={
                primary
                  ? "group rounded-3xl bg-gold-500 p-6 text-forest-950 shadow-lift transition hover:-translate-y-0.5 hover:bg-gold-400"
                  : "group rounded-3xl bg-white/[0.06] p-6 ring-1 ring-inset ring-white/10 transition hover:-translate-y-0.5 hover:bg-white/10"
              }
            >
              <Icon className="h-7 w-7" />
              <div className="mt-6 flex items-center justify-between text-lg font-bold">
                {title} <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
              </div>
              <div className={primary ? "mt-1 text-sm text-forest-900" : "mt-1 text-sm text-forest-200"}>{text}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

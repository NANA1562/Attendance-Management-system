// Demo data: `npm run db:seed`. Re-running replaces the demo business only.
//
// Demo logins (business code DEMO22):
//   1001 Akosua Mensah  — Senior, Supervisor   PIN 1234, password demo-pass-2026
//   1002 Michael Owusu  — Store Assistant      PIN 2222
//   1003 Ama Asante     — Cashier              PIN 3333
//   1004 Kofi Adjei     — Store Assistant      PIN 4444 (Tue–Sat 09:00–18:00)
//
// Created by hand while testing /setup on 2026-10-06 (not touched by this script):
//   "Test Shop" (code MCDWKM) — 1001 Test Owner, PIN 5678, password test-shop-pass;
//   1002 Yaw Test (Cashier). Safe to delete.

import { config } from "dotenv";
config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as s from "../src/db/schema";
import { databaseUrl } from "../src/db/url";
import { computeDay, resolveDayPlan, type EventType, type Tap } from "../src/lib/attendance/engine";
import { addDays, localDate, zonedToUtc } from "../src/lib/time";

const CODE = "DEMO22";
const TZ = "Africa/Accra";

const client = postgres(databaseUrl("migrations"), { prepare: false, max: 1 });
const db = drizzle(client, { schema: s });

async function main() {
  await db.delete(s.businesses).where(eq(s.businesses.businessCode, CODE));

  const [biz] = await db.insert(s.businesses).values({ name: "Pilot Retail Shop", businessCode: CODE }).returning();
  const b = biz.id;
  await db.insert(s.businessSettings).values({ businessId: b, timezone: TZ });

  const roles = await db
    .insert(s.jobRoles)
    .values([
      { businessId: b, name: "Supervisor", description: "Runs the shop floor" },
      { businessId: b, name: "Store Assistant", description: "Stock and shelves" },
      { businessId: b, name: "Cashier", description: "Till and payments" },
    ])
    .returning();
  const role = (name: string) => roles.find((r) => r.name === name)!.id;

  const people = [
    { staffCode: "1001", fullName: "Akosua Mensah", level: "senior" as const, role: "Supervisor", pin: "1234", password: "demo-pass-2026" },
    { staffCode: "1002", fullName: "Michael Owusu", level: "junior" as const, role: "Store Assistant", pin: "2222" },
    { staffCode: "1003", fullName: "Ama Asante", level: "junior" as const, role: "Cashier", pin: "3333" },
    { staffCode: "1004", fullName: "Kofi Adjei", level: "junior" as const, role: "Store Assistant", pin: "4444" },
  ];
  const staff = await db
    .insert(s.employees)
    .values(
      await Promise.all(
        people.map(async (p) => ({
          businessId: b,
          staffCode: p.staffCode,
          fullName: p.fullName,
          level: p.level,
          roleId: role(p.role),
          // Started a week ago, so the seeded history below falls after their start date.
          createdAt: new Date(Date.now() - 8 * 86400000),
          pinHash: await bcrypt.hash(p.pin, 10),
          passwordHash: p.password ? await bcrypt.hash(p.password, 10) : null,
        })),
      ),
    )
    .returning();
  const manager = staff[0];

  // Schedules: Mon–Fri 08:00–17:00, except Kofi on Tue–Sat 09:00–18:00.
  const scheduleRows = staff.flatMap((e) =>
    [0, 1, 2, 3, 4, 5, 6].map((d) => {
      const kofi = e.staffCode === "1004";
      const working = kofi ? d >= 2 && d <= 6 : d >= 1 && d <= 5;
      return {
        businessId: b,
        employeeId: e.id,
        dayOfWeek: d,
        isDayOff: !working,
        startTime: working ? (kofi ? "09:00" : "08:00") : null,
        endTime: working ? (kofi ? "18:00" : "17:00") : null,
        breakMinutes: working ? 60 : 0,
        createdBy: manager.id,
      };
    }),
  );
  const scheds = await db.insert(s.schedules).values(scheduleRows).returning();

  const today = localDate(new Date(), TZ);
  const kofi = staff.find((e) => e.staffCode === "1004")!;
  const leaves = await db
    .insert(s.leave)
    .values({
      businessId: b,
      employeeId: kofi.id,
      leaveType: "annual",
      dayPart: "full_day",
      startDate: addDays(today, -2),
      endDate: addDays(today, -2),
      reason: "Family event",
      createdBy: manager.id,
    })
    .returning();

  // Task templates.
  const templates: { role?: string; title: string; description?: string; frequency: "daily" | "specific_days"; daysOfWeek?: number[]; subtasks: string[] }[] = [
    {
      role: "Store Assistant",
      title: "Restock Beverage Section",
      frequency: "daily",
      subtasks: ["Check low-stock items", "Bring stock from warehouse", "Refill shelves", "Arrange products", "Confirm task completion"],
    },
    { role: "Store Assistant", title: "Clean sales floor", frequency: "daily", subtasks: [] },
    { role: "Store Assistant", title: "Inventory count", description: "Count fast-moving lines", frequency: "specific_days", daysOfWeek: [1], subtasks: [] },
    {
      role: "Cashier",
      title: "Opening Cash Register",
      frequency: "daily",
      subtasks: ["Count opening cash", "Check POS/device", "Confirm float", "Record opening balance"],
    },
    { role: "Cashier", title: "Close register", frequency: "daily", subtasks: ["Count cash", "Print end-of-day report", "Hand over to supervisor"] },
    { role: "Supervisor", title: "Morning walk-through", frequency: "daily", subtasks: ["Check shop is open on time", "Check staff are in", "Check shelves are full"] },
  ];
  for (const t of templates) {
    const [tpl] = await db
      .insert(s.taskTemplates)
      .values({
        businessId: b,
        roleId: role(t.role!),
        title: t.title,
        description: t.description,
        frequency: t.frequency,
        daysOfWeek: t.daysOfWeek ?? null,
      })
      .returning();
    if (t.subtasks.length) {
      await db
        .insert(s.taskTemplateSubtasks)
        .values(t.subtasks.map((title, i) => ({ businessId: b, taskTemplateId: tpl.id, title, sortOrder: i })));
    }
  }

  // A week of attendance history with a mix of patterns.
  const settings = { graceMinutes: 35, lateUntilMinutes: 70, absentAfterMinutes: 120, timezone: TZ };
  const patterns: { inOffset: number; outOffset: number; breakMins: number }[] = [
    { inOffset: -5, outOffset: 0, breakMins: 55 }, // on time
    { inOffset: 15, outOffset: 10, breakMins: 60 }, // grace
    { inOffset: 45, outOffset: 0, breakMins: 60 }, // late
    { inOffset: 0, outOffset: 90, breakMins: 45 }, // overtime
    { inOffset: -2, outOffset: -90, breakMins: 30 }, // early departure
    { inOffset: 0, outOffset: 0, breakMins: 0 }, // marker for no-show
  ];

  let n = 0;
  for (let back = 7; back >= 1; back--) {
    const workDate = addDays(today, -back);
    for (const [i, e] of staff.entries()) {
      const plan = resolveDayPlan(
        workDate,
        scheds.filter((x) => x.employeeId === e.id),
        leaves.filter((l) => l.employeeId === e.id),
      );
      if (plan.kind !== "working") continue;
      const p = patterns[(back + i * 2) % patterns.length];
      if (p === patterns[5]) continue; // no-show: no taps, shows as absent

      const at = (time: string, offset: number) => new Date(zonedToUtc(workDate, time, TZ).getTime() + offset * 60000);
      const taps: Tap[] = [{ eventType: "clock_in", eventAt: at(plan.start, p.inOffset) }];
      if (p.breakMins) {
        taps.push({ eventType: "break_start", eventAt: at("12:30", 0) }, { eventType: "break_end", eventAt: at("12:30", p.breakMins) });
      }
      taps.push({ eventType: "clock_out", eventAt: at(plan.end, p.outOffset) });

      const r = computeDay({ workDate, plan, taps, settings, now: new Date() });
      const [att] = await db
        .insert(s.attendance)
        .values({
          businessId: b,
          employeeId: e.id,
          workDate,
          scheduledStart: r.scheduledStart,
          scheduledEnd: r.scheduledEnd,
          breakAllowanceMinutes: r.breakAllowanceMinutes,
          clockInAt: r.clockInAt,
          clockOutAt: r.clockOutAt,
          status: r.status === "not_in_yet" ? "absent" : r.status,
          minutesLate: r.minutesLate,
          earlyLeaveMinutes: r.earlyLeaveMinutes,
          breakMinutes: r.breakMinutes,
          hoursWorked: r.hoursWorked,
          overtimeMinutes: r.overtimeMinutes,
          undertimeMinutes: r.undertimeMinutes,
          lateReason: r.status === "late" ? "Traffic at Kaneshie" : null,
        })
        .returning();
      await db.insert(s.attendanceEvents).values(
        taps.map((t) => ({ businessId: b, employeeId: e.id, attendanceId: att.id, eventType: t.eventType as EventType, eventAt: t.eventAt })),
      );
      n++;
    }
  }

  console.log(`Seeded "${biz.name}" (code ${CODE}): ${staff.length} staff, ${templates.length} task templates, ${n} past attendance days.`);
  console.log("Manager login: business DEMO22, staff ID 1001, PIN 1234, password demo-pass-2026");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());

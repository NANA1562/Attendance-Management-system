import "server-only";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { businesses, businessSettings, employees } from "@/db/schema";
import { isLocked, registerFailure } from "@/lib/auth/lockout";
import { audit } from "./audit";
import { readCookie, type KioskCookie, type PersonCookie } from "./session";

export type Employee = typeof employees.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type Settings = typeof businessSettings.$inferSelect;

export const hash = (secret: string) => bcrypt.hash(secret, 10);

type CheckResult = { ok: true; employee: Employee } | { ok: false; error: string };

/**
 * Check a staff ID + PIN (and the dashboard password, for managers).
 * Wrong attempts count toward the lockout; every failure is audited.
 */
export async function checkCredentials(input: {
  businessId: string;
  staffCode: string;
  pin: string;
  password?: string;
}): Promise<CheckResult> {
  const now = new Date();
  const wrong = input.password === undefined ? "Wrong staff ID or PIN." : "Wrong staff ID, PIN or password.";
  const [row] = await db
    .select({ e: employees, s: businessSettings })
    .from(employees)
    .innerJoin(businessSettings, eq(businessSettings.businessId, employees.businessId))
    .where(and(eq(employees.businessId, input.businessId), eq(employees.staffCode, input.staffCode.trim())));

  if (!row || row.e.status !== "active") {
    await audit({ businessId: input.businessId, employeeId: null, action: "failed_login", detail: `Unknown or inactive staff ID ${input.staffCode}` });
    return { ok: false, error: wrong };
  }
  const { e, s } = row;

  if (isLocked(e.lockedUntil, now)) {
    const mins = Math.ceil((e.lockedUntil!.getTime() - now.getTime()) / 60000);
    return { ok: false, error: `Too many wrong attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` };
  }

  let good = await bcrypt.compare(input.pin, e.pinHash);
  if (good && input.password !== undefined) {
    good = !!e.passwordHash && (await bcrypt.compare(input.password, e.passwordHash));
  }

  if (!good) {
    const next = registerFailure(e.failedAttempts, e.lockedUntil, s, now);
    await db.update(employees).set(next).where(eq(employees.id, e.id));
    await audit({ businessId: e.businessId, employeeId: null, action: "failed_login", targetType: "employee", targetId: e.id });
    if (next.lockedUntil) {
      return { ok: false, error: `Too many wrong attempts. This ID is locked for ${s.lockoutMinutes} minutes.` };
    }
    return { ok: false, error: wrong };
  }

  if (e.failedAttempts > 0 || e.lockedUntil) {
    await db.update(employees).set({ failedAttempts: 0, lockedUntil: null }).where(eq(employees.id, e.id));
  }
  return { ok: true, employee: e };
}

async function loadPerson(businessId: string, employeeId: string) {
  const [row] = await db
    .select({ employee: employees, business: businesses, settings: businessSettings })
    .from(employees)
    .innerJoin(businesses, eq(businesses.id, employees.businessId))
    .innerJoin(businessSettings, eq(businessSettings.businessId, employees.businessId))
    .where(and(eq(employees.id, employeeId), eq(employees.businessId, businessId)));
  if (!row || row.employee.status !== "active" || row.business.status !== "active") return null;
  return row;
}

/** The signed-in senior, or null. */
export const currentManager = cache(async () => {
  const c = await readCookie<PersonCookie>("manager");
  const row = c && (await loadPerson(c.businessId, c.employeeId));
  return row && row.employee.level === "senior" ? row : null;
});

/** The signed-in senior, or redirect to the dashboard login. */
export const requireManager = cache(async () => {
  const row = await currentManager();
  if (!row) redirect("/manage/login");
  return row;
});

/** This tablet's business, or null if the tablet isn't set up. */
export const getKiosk = cache(async () => {
  const c = await readCookie<KioskCookie>("kiosk");
  if (!c) return null;
  const [row] = await db
    .select({ business: businesses, settings: businessSettings })
    .from(businesses)
    .innerJoin(businessSettings, eq(businessSettings.businessId, businesses.id))
    .where(eq(businesses.id, c.businessId));
  return row && row.business.status === "active" ? row : null;
});

/** The staff member identified on this tablet, or back to the keypad. */
export const requireStaff = cache(async () => {
  const c = await readCookie<PersonCookie>("staff");
  const [kiosk, row] = await Promise.all([getKiosk(), c ? loadPerson(c.businessId, c.employeeId) : null]);
  if (!kiosk || !row || row.business.id !== kiosk.business.id) redirect("/kiosk");
  return row;
});

"use server";

import { and, eq, gte, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import {
  businessSettings,
  employees,
  jobRoles,
  leave,
  schedules,
  taskTemplates,
  taskTemplateSubtasks,
} from "@/db/schema";
import type { ActionState } from "@/components/action-form";
import { parseForm } from "@/lib/form";
import { localDate } from "@/lib/time";
import { checkbox, date, name, optional, password, time } from "@/lib/validation";
import { audit } from "@/server/audit";
import { hash, requireManager } from "@/server/auth";
import { newPin, nextStaffCode } from "@/server/codes";
import { clearCookie } from "@/server/session";

const uuid = z.string().uuid();

/** Load an employee only if they belong to the manager's business. */
async function ownEmployee(businessId: string, employeeId: string) {
  const [e] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.businessId, businessId)));
  return e ?? null;
}

async function ownRole(businessId: string, roleId: string | null) {
  if (!roleId) return true;
  const [r] = await db.select({ id: jobRoles.id }).from(jobRoles).where(and(eq(jobRoles.id, roleId), eq(jobRoles.businessId, businessId)));
  return !!r;
}

const roleId = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .pipe(uuid.nullable());

// ---------- staff ----------

const staffSchema = z.object({
  fullName: name("Full name"),
  level: z.enum(["senior", "junior"]),
  roleId,
  phone: optional,
  password: z.string().optional(),
});

export async function addStaff(_: ActionState, form: FormData): Promise<ActionState> {
  const { employee: me, business } = await requireManager();
  const { ok, data, error } = parseForm(staffSchema, form);
  if (!ok) return { error };
  if (!(await ownRole(business.id, data.roleId))) return { error: "Unknown role." };
  if (data.level === "senior") {
    const p = password.safeParse(data.password ?? "");
    if (!p.success) return { error: "Seniors need a dashboard password of at least 8 characters." };
  }

  const pin = newPin();
  const [pinHash, passwordHash] = await Promise.all([
    hash(pin),
    data.level === "senior" ? hash(data.password!) : Promise.resolve(null),
  ]);

  const created = await db.transaction(async (tx) => {
    const staffCode = await nextStaffCode(business.id, tx);
    const [e] = await tx
      .insert(employees)
      .values({
        businessId: business.id,
        staffCode,
        fullName: data.fullName,
        level: data.level,
        roleId: data.roleId,
        phone: data.phone,
        pinHash,
        passwordHash,
      })
      .returning();
    // Give new staff a standard Mon–Fri 08:00–17:00 week; the manager edits it after.
    await tx.insert(schedules).values(
      [0, 1, 2, 3, 4, 5, 6].map((d) => ({
        businessId: business.id,
        employeeId: e.id,
        dayOfWeek: d,
        isDayOff: d === 0 || d === 6,
        startTime: d === 0 || d === 6 ? null : "08:00",
        endTime: d === 0 || d === 6 ? null : "17:00",
        createdBy: me.id,
      })),
    );
    await audit({ businessId: business.id, employeeId: me.id, action: "staff_created", targetType: "employee", targetId: e.id, detail: e.fullName }, tx);
    return e;
  });

  revalidatePath("/manage/staff");
  return {
    ok: `${created.fullName} added with staff ID ${created.staffCode}. Default schedule: Mon–Fri 08:00–17:00.`,
    secret: { label: `PIN for ${created.fullName} (ID ${created.staffCode})`, value: pin },
  };
}

const updateStaffSchema = staffSchema.omit({ password: true }).extend({
  employeeId: uuid,
  status: z.enum(["active", "inactive"]),
});

export async function updateStaff(_: ActionState, form: FormData): Promise<ActionState> {
  const { employee: me, business } = await requireManager();
  const { ok, data, error } = parseForm(updateStaffSchema, form);
  if (!ok) return { error };
  const target = await ownEmployee(business.id, data.employeeId);
  if (!target) return { error: "Employee not found." };
  if (!(await ownRole(business.id, data.roleId))) return { error: "Unknown role." };
  if (target.id === me.id && (data.level !== "senior" || data.status !== "active")) {
    return { error: "You can't remove your own senior access." };
  }
  if (data.level === "senior" && !target.passwordHash) {
    return { error: "Set a dashboard password for this person first, then make them senior." };
  }

  await db
    .update(employees)
    .set({ fullName: data.fullName, level: data.level, roleId: data.roleId, phone: data.phone, status: data.status })
    .where(eq(employees.id, target.id));
  await audit({ businessId: business.id, employeeId: me.id, action: "staff_updated", targetType: "employee", targetId: target.id });
  revalidatePath(`/manage/staff/${target.id}`);
  return { ok: "Saved." };
}

export async function resetPin(_: ActionState, form: FormData): Promise<ActionState> {
  const { employee: me, business } = await requireManager();
  const target = await ownEmployee(business.id, String(form.get("employeeId")));
  if (!target) return { error: "Employee not found." };
  const pin = newPin();
  await db
    .update(employees)
    .set({ pinHash: await hash(pin), failedAttempts: 0, lockedUntil: null })
    .where(eq(employees.id, target.id));
  await audit({ businessId: business.id, employeeId: me.id, action: "pin_reset", targetType: "employee", targetId: target.id });
  return { secret: { label: `New PIN for ${target.fullName}`, value: pin } };
}

export async function setPassword(_: ActionState, form: FormData): Promise<ActionState> {
  const { employee: me, business } = await requireManager();
  const target = await ownEmployee(business.id, String(form.get("employeeId")));
  if (!target) return { error: "Employee not found." };
  const p = password.safeParse(form.get("password"));
  if (!p.success) return { error: p.error.issues[0].message };
  await db.update(employees).set({ passwordHash: await hash(p.data) }).where(eq(employees.id, target.id));
  await audit({ businessId: business.id, employeeId: me.id, action: "password_set", targetType: "employee", targetId: target.id });
  return { ok: "Dashboard password updated." };
}

export async function unlockStaff(form: FormData) {
  const { employee: me, business } = await requireManager();
  const target = await ownEmployee(business.id, String(form.get("employeeId")));
  if (!target) return;
  await db.update(employees).set({ failedAttempts: 0, lockedUntil: null }).where(eq(employees.id, target.id));
  await audit({ businessId: business.id, employeeId: me.id, action: "staff_unlocked", targetType: "employee", targetId: target.id });
  revalidatePath(`/manage/staff/${target.id}`);
}

// ---------- schedule ----------

export async function saveSchedule(_: ActionState, form: FormData): Promise<ActionState> {
  const { employee: me, business } = await requireManager();
  const target = await ownEmployee(business.id, String(form.get("employeeId")));
  if (!target) return { error: "Employee not found." };

  const days: { d: number; working: boolean; start: string; end: string; breakMinutes: number }[] = [];
  for (let d = 0; d < 7; d++) {
    const working = form.get(`work_${d}`) === "on";
    const start = String(form.get(`start_${d}`) ?? "");
    const end = String(form.get(`end_${d}`) ?? "");
    const breakMinutes = Number(form.get(`break_${d}`) ?? 0);
    if (working) {
      if (!time.safeParse(start).success || !time.safeParse(end).success) return { error: "Every working day needs a start and end time." };
      if (end <= start) return { error: "End time must be after start time (night shifts aren't supported)." };
      if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 240) return { error: "Break must be 0–240 minutes." };
    }
    days.push({ d, working, start, end, breakMinutes });
  }

  await db.transaction(async (tx) => {
    for (const day of days) {
      const values = {
        isDayOff: !day.working,
        startTime: day.working ? day.start : null,
        endTime: day.working ? day.end : null,
        breakMinutes: day.working ? day.breakMinutes : 0,
        createdBy: me.id,
      };
      await tx
        .insert(schedules)
        .values({ businessId: business.id, employeeId: target.id, dayOfWeek: day.d, ...values })
        .onConflictDoUpdate({
          target: [schedules.employeeId, schedules.dayOfWeek],
          // Matches the partial unique index schedules_employee_dow_uq.
          targetWhere: sql`day_of_week IS NOT NULL`,
          set: values,
        });
    }
    await audit({ businessId: business.id, employeeId: me.id, action: "schedule_changed", targetType: "employee", targetId: target.id }, tx);
  });
  revalidatePath(`/manage/staff/${target.id}`);
  return { ok: "Schedule saved." };
}


// ---------- leave ----------

const leaveSchema = z
  .object({
    employeeId: uuid,
    leaveType: z.enum(["annual", "sick", "permission", "other"]),
    dayPart: z.enum(["full_day", "morning_off", "afternoon_off"]),
    startDate: date,
    endDate: z.string().optional(),
    reason: optional,
  })
  .transform((v) => ({ ...v, endDate: v.dayPart !== "full_day" || !v.endDate ? v.startDate : v.endDate }))
  .refine((v) => v.endDate >= v.startDate, "End date must be on or after the start date.");

export async function addLeave(_: ActionState, form: FormData): Promise<ActionState> {
  const { employee: me, business } = await requireManager();
  const { ok, data, error } = parseForm(leaveSchema, form);
  if (!ok) return { error };
  const target = await ownEmployee(business.id, data.employeeId);
  if (!target) return { error: "Employee not found." };

  const [overlap] = await db
    .select({ id: leave.id })
    .from(leave)
    .where(
      and(
        eq(leave.employeeId, target.id),
        eq(leave.status, "active"),
        lte(leave.startDate, data.endDate),
        gte(leave.endDate, data.startDate),
      ),
    );
  if (overlap) return { error: "This overlaps leave that's already recorded. Cancel that first." };

  const [l] = await db
    .insert(leave)
    .values({ ...data, businessId: business.id, employeeId: target.id, createdBy: me.id })
    .returning({ id: leave.id });
  await audit({ businessId: business.id, employeeId: me.id, action: "leave_added", targetType: "leave", targetId: l.id });
  revalidatePath(`/manage/staff/${target.id}`);
  return { ok: "Leave recorded." };
}

export async function cancelLeave(form: FormData) {
  const { employee: me, business } = await requireManager();
  const id = String(form.get("leaveId"));
  const [l] = await db
    .update(leave)
    .set({ status: "cancelled" })
    .where(and(eq(leave.id, id), eq(leave.businessId, business.id)))
    .returning();
  if (!l) return;
  await audit({ businessId: business.id, employeeId: me.id, action: "leave_cancelled", targetType: "leave", targetId: l.id });
  revalidatePath(`/manage/staff/${l.employeeId}`);
}

// ---------- settings ----------

const minutes = (label: string, max: number) =>
  z.coerce.number().int(`${label} must be whole minutes.`).min(0).max(max, `${label} is too large.`);

const settingsSchema = z
  .object({
    graceMinutes: minutes("Grace", 600),
    lateUntilMinutes: minutes("Late", 600),
    absentAfterMinutes: minutes("Absent", 1440),
    defaultBreakMinutes: minutes("Break", 240),
    lockoutAttempts: z.coerce.number().int().min(1).max(20),
    lockoutMinutes: z.coerce.number().int().min(1).max(1440),
    photoOnTap: checkbox,
    timezone: z.string().refine((tz) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown timezone."),
  })
  .refine((s) => s.graceMinutes < s.lateUntilMinutes, "Grace must end before late ends.")
  .refine((s) => s.lateUntilMinutes < s.absentAfterMinutes, "Late must end before the absent cutoff.");

export async function saveSettings(_: ActionState, form: FormData): Promise<ActionState> {
  const { employee: me, business } = await requireManager();
  const { ok, data, error } = parseForm(settingsSchema, form);
  if (!ok) return { error };
  await db.update(businessSettings).set({ ...data, updatedBy: me.id }).where(eq(businessSettings.businessId, business.id));
  await audit({ businessId: business.id, employeeId: me.id, action: "settings_changed" });
  revalidatePath("/manage", "layout");
  return { ok: "Settings saved." };
}

// ---------- roles ----------

export async function createRole(_: ActionState, form: FormData): Promise<ActionState> {
  const { employee: me, business } = await requireManager();
  const { ok, data, error } = parseForm(z.object({ name: name("Role name"), description: optional }), form);
  if (!ok) return { error };
  const [dupe] = await db
    .select({ id: jobRoles.id })
    .from(jobRoles)
    .where(and(eq(jobRoles.businessId, business.id), eq(jobRoles.name, data.name)));
  if (dupe) return { error: "A role with that name already exists." };
  const [r] = await db.insert(jobRoles).values({ ...data, businessId: business.id }).returning({ id: jobRoles.id });
  await audit({ businessId: business.id, employeeId: me.id, action: "role_created", targetType: "role", targetId: r.id });
  revalidatePath("/manage/roles");
  return { ok: `Role "${data.name}" created.` };
}

export async function toggleRole(form: FormData) {
  const { employee: me, business } = await requireManager();
  const id = String(form.get("roleId"));
  const status = form.get("status") === "inactive" ? "inactive" : "active";
  await db.update(jobRoles).set({ status }).where(and(eq(jobRoles.id, id), eq(jobRoles.businessId, business.id)));
  await audit({ businessId: business.id, employeeId: me.id, action: `role_${status === "active" ? "enabled" : "disabled"}`, targetType: "role", targetId: id });
  revalidatePath("/manage/roles");
}

// ---------- task templates ----------

const templateSchema = z.object({
  title: name("Task title"),
  description: optional,
  target: z.string().regex(/^(role|employee):[0-9a-f-]{36}$/, "Choose who the task is for."),
  frequency: z.enum(["daily", "weekly", "specific_days", "monthly", "one_time", "shift_based"]),
  daysOfWeek: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? [] : ([] as string[]).concat(v).map(Number))),
  dayOfMonth: z.string().optional(),
  oneTimeDate: z.string().optional(),
  required: checkbox,
  subtasks: z.string().optional(),
});

export async function createTemplate(_: ActionState, form: FormData): Promise<ActionState> {
  const { employee: me, business } = await requireManager();
  const { ok, data, error } = parseForm(templateSchema, form);
  if (!ok) return { error };

  const [kind, targetId] = data.target.split(":") as ["role" | "employee", string];
  if (kind === "role" ? !(await ownRole(business.id, targetId)) : !(await ownEmployee(business.id, targetId))) {
    return { error: "Choose who the task is for." };
  }

  let daysOfWeek: number[] | null = null;
  let dayOfMonth: number | null = null;
  let oneTimeDate: string | null = null;
  if (data.frequency === "weekly" || data.frequency === "specific_days") {
    if (data.daysOfWeek.length === 0) return { error: "Pick at least one day of the week." };
    daysOfWeek = data.daysOfWeek;
  } else if (data.frequency === "monthly") {
    dayOfMonth = Number(data.dayOfMonth);
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) return { error: "Day of month must be 1–31." };
  } else if (data.frequency === "one_time") {
    if (!date.safeParse(data.oneTimeDate).success) return { error: "Pick the date for a one-time task." };
    oneTimeDate = data.oneTimeDate!;
  }

  const subtasks = (data.subtasks ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);

  await db.transaction(async (tx) => {
    const [t] = await tx
      .insert(taskTemplates)
      .values({
        businessId: business.id,
        roleId: kind === "role" ? targetId : null,
        employeeId: kind === "employee" ? targetId : null,
        title: data.title,
        description: data.description,
        frequency: data.frequency,
        daysOfWeek,
        dayOfMonth,
        oneTimeDate,
        required: data.required,
      })
      .returning({ id: taskTemplates.id });
    if (subtasks.length) {
      await tx.insert(taskTemplateSubtasks).values(
        subtasks.map((title, i) => ({ businessId: business.id, taskTemplateId: t.id, title, sortOrder: i })),
      );
    }
    await audit({ businessId: business.id, employeeId: me.id, action: "task_template_created", targetType: "task_template", targetId: t.id }, tx);
  });
  revalidatePath("/manage/tasks");
  return { ok: `Task "${data.title}" created. It appears on matching staff's lists from today.` };
}

export async function toggleTemplate(form: FormData) {
  const { employee: me, business } = await requireManager();
  const id = String(form.get("templateId"));
  const status = form.get("status") === "inactive" ? "inactive" : "active";
  await db
    .update(taskTemplates)
    .set({ status })
    .where(and(eq(taskTemplates.id, id), eq(taskTemplates.businessId, business.id)));
  await audit({ businessId: business.id, employeeId: me.id, action: `task_template_${status === "active" ? "enabled" : "disabled"}`, targetType: "task_template", targetId: id });
  revalidatePath("/manage/tasks");
}

// ---------- tablet ----------

/** Forget the tablet's business (e.g. moving the tablet). Seniors only. */
export async function resetTablet() {
  await requireManager();
  await clearCookie("kiosk");
  await clearCookie("staff");
  redirect("/kiosk");
}

// ---------- rota: one-off changes for a single date ----------

const dayShiftSchema = z.object({
  employeeId: uuid,
  date,
  mode: z.enum(["work", "off", "reset"]),
  start: z.string().optional(),
  end: z.string().optional(),
  breakMinutes: z.coerce.number().int().min(0).max(240).optional(),
});

export async function saveDayShift(_: ActionState, form: FormData): Promise<ActionState> {
  const { employee: me, business, settings } = await requireManager();
  const { ok, data, error } = parseForm(dayShiftSchema, form);
  if (!ok) return { error };
  const target = await ownEmployee(business.id, data.employeeId);
  if (!target) return { error: "Employee not found." };
  if (data.date < localDate(new Date(), settings.timezone)) return { error: "Past days can't be changed here." };

  if (data.mode === "reset") {
    await db
      .delete(schedules)
      .where(and(eq(schedules.employeeId, target.id), eq(schedules.shiftDate, data.date)));
  } else {
    if (data.mode === "work") {
      if (!time.safeParse(data.start).success || !time.safeParse(data.end).success) return { error: "Set a start and end time." };
      if (data.end! <= data.start!) return { error: "End must be after start (no night shifts)." };
    }
    const values = {
      isDayOff: data.mode === "off",
      startTime: data.mode === "work" ? data.start! : null,
      endTime: data.mode === "work" ? data.end! : null,
      breakMinutes: data.mode === "work" ? (data.breakMinutes ?? settings.defaultBreakMinutes) : 0,
      createdBy: me.id,
    };
    await db
      .insert(schedules)
      .values({ businessId: business.id, employeeId: target.id, shiftDate: data.date, ...values })
      .onConflictDoUpdate({
        target: [schedules.employeeId, schedules.shiftDate],
        // Matches the partial unique index schedules_employee_date_uq.
        targetWhere: sql`shift_date IS NOT NULL`,
        set: values,
      });
  }
  await audit({
    businessId: business.id,
    employeeId: me.id,
    action: "schedule_changed",
    targetType: "employee",
    targetId: target.id,
    detail: `${data.date}: ${data.mode === "reset" ? "back to usual" : data.mode === "off" ? "day off" : `${data.start}–${data.end}`}`,
  });
  revalidatePath("/manage/rota");
  return { ok: "Saved." };
}

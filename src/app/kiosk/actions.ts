"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import type { ActionState } from "@/components/action-form";
import { parseForm } from "@/lib/form";
import { recordTap, saveLateReason } from "@/server/attendance";
import { checkCredentials, getKiosk, requireStaff } from "@/server/auth";
import { clearCookie, setCookie } from "@/server/session";
import { setSubtask, setTaskStatus } from "@/server/tasks";

export async function registerTablet(_: ActionState, form: FormData): Promise<ActionState> {
  const code = String(form.get("businessCode") ?? "").trim().toUpperCase();
  const [b] = await db.select().from(businesses).where(eq(businesses.businessCode, code));
  if (!b || b.status !== "active") return { error: "Business code not found." };
  await setCookie("kiosk", { businessId: b.id, businessCode: b.businessCode });
  redirect("/kiosk");
}

export async function kioskLogin(_: ActionState, form: FormData): Promise<ActionState> {
  const kiosk = await getKiosk();
  if (!kiosk) redirect("/kiosk");
  const res = await checkCredentials({
    businessId: kiosk.business.id,
    staffCode: String(form.get("staffCode") ?? ""),
    pin: String(form.get("pin") ?? ""),
  });
  if (!res.ok) return { error: res.error };
  await setCookie("staff", { businessId: kiosk.business.id, employeeId: res.employee.id });
  redirect("/kiosk/me");
}

const tapSchema = z.object({ type: z.enum(["clock_in", "break_start", "break_end", "clock_out"]) });

export async function tap(form: FormData) {
  const { employee, settings } = await requireStaff();
  const { ok, data, error } = parseForm(tapSchema, form);
  if (!ok) redirect(`/kiosk/me?error=${encodeURIComponent(error)}`);
  const res = await recordTap(employee, settings, data.type);
  if (!res.ok) redirect(`/kiosk/me?error=${encodeURIComponent(res.error)}`);
  redirect(`/kiosk/me?done=${data.type}`);
}

export async function lateReason(form: FormData) {
  const { employee, settings } = await requireStaff();
  const reason = String(form.get("reason") ?? "").trim();
  if (reason) await saveLateReason(employee, settings, reason);
  revalidatePath("/kiosk/me");
}

export async function toggleSubtask(form: FormData) {
  const { employee } = await requireStaff();
  await setSubtask(employee, String(form.get("id")), form.get("done") === "1");
  revalidatePath("/kiosk/me");
}

const taskSchema = z.object({ id: z.string().uuid(), status: z.enum(["not_started", "in_progress", "completed", "skipped"]) });

export async function updateTask(form: FormData) {
  const { employee } = await requireStaff();
  const { data } = parseForm(taskSchema, form);
  if (data) await setTaskStatus(employee, data.id, data.status);
  revalidatePath("/kiosk/me");
}

/** Back to the keypad for the next person. */
export async function doneOnTablet() {
  await clearCookie("staff");
  redirect("/kiosk");
}

"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import type { ActionState } from "@/components/action-form";
import { parseForm } from "@/lib/form";
import { audit } from "@/server/audit";
import { checkCredentials, requireManager } from "@/server/auth";
import { clearCookie, setCookie } from "@/server/session";

const schema = z.object({
  businessCode: z.string().trim().toUpperCase().min(1, "Enter the business code."),
  staffCode: z.string().trim().min(1, "Enter your staff ID."),
  pin: z.string().min(1, "Enter your PIN."),
  password: z.string().min(1, "Enter your password."),
});

export async function managerLogin(_: ActionState, form: FormData): Promise<ActionState> {
  const { ok, data, error } = parseForm(schema, form);
  if (!ok) return { error };

  const [business] = await db.select().from(businesses).where(eq(businesses.businessCode, data.businessCode));
  if (!business || business.status !== "active") return { error: "Business code not found." };

  const res = await checkCredentials({ businessId: business.id, ...data });
  if (!res.ok) return { error: res.error };
  if (res.employee.level !== "senior") return { error: "Only senior staff can open the dashboard." };

  await setCookie("manager", { businessId: business.id, employeeId: res.employee.id });
  await audit({ businessId: business.id, employeeId: res.employee.id, action: "manager_login" });
  redirect("/manage");
}

export async function managerLogout() {
  await requireManager();
  await clearCookie("manager");
  redirect("/manage/login");
}

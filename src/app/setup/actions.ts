"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { businesses, businessSettings, employees } from "@/db/schema";
import type { ActionState } from "@/components/action-form";
import { parseForm } from "@/lib/form";
import { name, optional, password, pin } from "@/lib/validation";
import { audit } from "@/server/audit";
import { hash } from "@/server/auth";
import { newBusinessCode } from "@/server/codes";
import { setCookie } from "@/server/session";

const schema = z.object({
  businessName: name("Business name"),
  phone: optional,
  fullName: name("Your name"),
  pin,
  password,
});

export async function createBusiness(_: ActionState, form: FormData): Promise<ActionState> {
  const { ok, data, error } = parseForm(schema, form);
  if (!ok) return { error };

  const businessCode = await newBusinessCode();
  const [pinHash, passwordHash] = await Promise.all([hash(data.pin), hash(data.password)]);

  const { businessId, employeeId } = await db.transaction(async (tx) => {
    const [b] = await tx
      .insert(businesses)
      .values({ name: data.businessName, businessCode, phone: data.phone })
      .returning({ id: businesses.id });
    await tx.insert(businessSettings).values({ businessId: b.id });
    const [e] = await tx
      .insert(employees)
      .values({ businessId: b.id, staffCode: "1001", fullName: data.fullName, level: "senior", pinHash, passwordHash })
      .returning({ id: employees.id });
    await audit({ businessId: b.id, employeeId: e.id, action: "business_created" }, tx);
    return { businessId: b.id, employeeId: e.id };
  });

  await setCookie("manager", { businessId, employeeId });
  redirect("/manage?welcome=1");
}

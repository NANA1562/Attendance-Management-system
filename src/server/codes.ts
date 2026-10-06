import "server-only";
import { randomInt } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { businesses, employees } from "@/db/schema";
import { eq } from "drizzle-orm";

// No 0/O/1/I so codes read cleanly off a screen.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function newBusinessCode(): Promise<string> {
  for (;;) {
    const code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    const [taken] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.businessCode, code));
    if (!taken) return code;
  }
}

/** Numeric staff codes (1001, 1002, …) so the tablet keypad can be digits only. */
export async function nextStaffCode(businessId: string, tx: Tx | typeof db = db): Promise<string> {
  const [row] = await tx
    .select({ max: sql<number | null>`max(nullif(regexp_replace(${employees.staffCode}, '\\D', '', 'g'), '')::int)` })
    .from(employees)
    .where(eq(employees.businessId, businessId));
  return String(Math.max(1000, row?.max ?? 1000) + 1);
}

export function newPin(): string {
  return String(randomInt(10000)).padStart(4, "0");
}

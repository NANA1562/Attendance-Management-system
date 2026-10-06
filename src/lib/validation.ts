import { z } from "zod";

export const pin = z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits.");
export const password = z.string().min(8, "Password must be at least 8 characters.");
export const name = (what: string) => z.string().trim().min(1, `${what} is required.`).max(120);
export const optional = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null);
export const time = z.string().regex(/^\d{2}:\d{2}$/, "Use a time like 08:00.");
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");
export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.undefined()])
  .transform((v) => v !== undefined);

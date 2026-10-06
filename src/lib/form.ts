import type { z } from "zod";

/** Parse FormData with a zod schema; returns the first error message on failure. */
export function parseForm<T extends z.ZodType>(
  schema: T,
  data: FormData,
): { ok: true; data: z.infer<T>; error?: undefined } | { ok: false; data?: undefined; error: string } {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of data.entries()) {
    if (k.startsWith("$ACTION")) continue;
    raw[k] = raw[k] === undefined ? v : ([] as unknown[]).concat(raw[k], v);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  return { ok: true, data: parsed.data };
}

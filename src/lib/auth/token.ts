// Signed cookie payloads (HS256 JWT). No Next/server imports so proxy.ts can use it.
import { jwtVerify, SignJWT } from "jose";

const key = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? "");

export async function sign(payload: Record<string, unknown>, maxAgeSeconds: number) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(key());
}

export async function verify<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload as T;
  } catch {
    return null;
  }
}

export const COOKIES = {
  /** Which business this tablet belongs to. */
  kiosk: "kiosk",
  /** A staff member identified on the tablet, for a few minutes. */
  staff: "staff",
  /** A senior signed in to the dashboard. */
  manager: "mgr",
} as const;

export const MAX_AGE = {
  kiosk: 60 * 60 * 24 * 365,
  staff: 60 * 5,
  manager: 60 * 60 * 12,
};

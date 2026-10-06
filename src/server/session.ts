import "server-only";
import { cookies } from "next/headers";
import { COOKIES, MAX_AGE, sign, verify } from "@/lib/auth/token";

export interface KioskCookie {
  businessId: string;
  businessCode: string;
}
export interface PersonCookie {
  businessId: string;
  employeeId: string;
}

type Kind = keyof typeof COOKIES;

export async function setCookie(kind: Kind, payload: KioskCookie | PersonCookie) {
  const store = await cookies();
  store.set(COOKIES[kind], await sign({ ...payload }, MAX_AGE[kind]), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE[kind],
  });
}

export async function readCookie<T extends KioskCookie | PersonCookie>(kind: Kind): Promise<T | null> {
  const store = await cookies();
  return verify<T>(store.get(COOKIES[kind])?.value);
}

export async function clearCookie(kind: Kind) {
  (await cookies()).delete(COOKIES[kind]);
}

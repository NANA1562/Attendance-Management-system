import { describe, expect, it } from "vitest";
import { isLocked, registerFailure } from "./lockout";

const s = { lockoutAttempts: 4, lockoutMinutes: 3 };
const now = new Date("2026-10-05T08:00:00Z");

describe("lockout", () => {
  it("locks for 3 minutes on the 4th wrong attempt", () => {
    let c = { failedAttempts: 0, lockedUntil: null as Date | null };
    for (let i = 0; i < 3; i++) c = registerFailure(c.failedAttempts, c.lockedUntil, s, now);
    expect(c).toEqual({ failedAttempts: 3, lockedUntil: null });
    c = registerFailure(c.failedAttempts, c.lockedUntil, s, now);
    expect(c.lockedUntil).toEqual(new Date("2026-10-05T08:03:00Z"));
    expect(isLocked(c.lockedUntil, new Date("2026-10-05T08:02:59Z"))).toBe(true);
    expect(isLocked(c.lockedUntil, new Date("2026-10-05T08:03:00Z"))).toBe(false);
  });

  it("an expired lock starts a fresh count", () => {
    const c = registerFailure(0, new Date("2026-10-05T07:59:00Z"), s, now);
    expect(c).toEqual({ failedAttempts: 1, lockedUntil: null });
  });
});

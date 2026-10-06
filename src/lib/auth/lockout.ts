// Login lockout: after N wrong attempts the staff ID is locked for M minutes.

export interface LockoutSettings {
  lockoutAttempts: number;
  lockoutMinutes: number;
}

export function isLocked(lockedUntil: Date | null, now: Date): boolean {
  return !!lockedUntil && lockedUntil > now;
}

/** New counters after a wrong PIN/password. */
export function registerFailure(
  failedAttempts: number,
  lockedUntil: Date | null,
  s: LockoutSettings,
  now: Date,
): { failedAttempts: number; lockedUntil: Date | null } {
  // A lock that has expired starts a fresh count.
  const attempts = (lockedUntil && lockedUntil <= now ? 0 : failedAttempts) + 1;
  if (attempts >= s.lockoutAttempts) {
    return { failedAttempts: 0, lockedUntil: new Date(now.getTime() + s.lockoutMinutes * 60000) };
  }
  return { failedAttempts: attempts, lockedUntil: null };
}

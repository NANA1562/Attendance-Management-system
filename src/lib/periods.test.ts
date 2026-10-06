import { describe, expect, it } from "vitest";
import { periodRange, resolvePeriod } from "./periods";

// 2026-10-06 is a Tuesday.
const T = "2026-10-06";

describe("periods", () => {
  it("weeks run Monday to Sunday", () => {
    expect(periodRange("this_week", T)).toEqual({ from: "2026-10-05", to: "2026-10-11" });
    expect(periodRange("last_week", T)).toEqual({ from: "2026-09-28", to: "2026-10-04" });
  });
  it("months use real month lengths", () => {
    expect(periodRange("this_month", T)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodRange("last_month", T)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(periodRange("last_month", "2026-01-15")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(periodRange("this_month", "2028-02-10").to).toBe("2028-02-29");
  });
  it("custom ranges are validated and capped", () => {
    expect(resolvePeriod({ period: "custom", from: "2026-10-01", to: "2026-10-03" }, T)).toMatchObject({ from: "2026-10-01", to: "2026-10-03" });
    expect(resolvePeriod({ period: "custom", from: "2026-10-05", to: "2026-10-01" }, T).key).toBe("this_week");
    expect(resolvePeriod({ period: "custom", from: "2026-01-01", to: "2026-12-31" }, T).to).toBe("2026-04-03");
  });
});

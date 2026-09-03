import { describe, expect, it } from "vitest";
import { periodToRange, toISODate, toISODateTime, round, PERIODS, INTERVALS } from "../src/format.js";

describe("periodToRange", () => {
  const now = new Date("2026-09-02T12:00:00Z");

  it("computes a fixed look-back for 1mo (30 days)", () => {
    const { period1, period2 } = periodToRange("1mo", now);
    expect(period2).toEqual(now);
    expect(period1.toISOString().slice(0, 10)).toBe("2026-08-03");
  });

  it("uses Jan 1 of the current year for ytd", () => {
    expect(periodToRange("ytd", now).period1.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("uses the unix epoch for max", () => {
    expect(periodToRange("max", now).period1.getTime()).toBe(0);
  });
});

describe("toISODate / toISODateTime", () => {
  it("converts epoch seconds", () => {
    expect(toISODate(1_756_814_400)).toBe("2025-09-02");
  });
  it("converts epoch milliseconds", () => {
    expect(toISODate(1_756_814_400_000)).toBe("2025-09-02");
  });
  it("passes through Date and returns full ISO for datetime", () => {
    expect(toISODateTime(new Date("2026-09-02T09:30:00Z"))).toBe("2026-09-02T09:30:00.000Z");
  });
  it("returns null for nullish / invalid", () => {
    expect(toISODate(undefined)).toBeNull();
    expect(toISODate("not a date")).toBeNull();
  });
});

describe("round", () => {
  it("rounds to 2 dp by default", () => expect(round(3.14159)).toBe(3.14));
  it("respects dp", () => expect(round(3.14159, 3)).toBe(3.142));
  it("returns null for non-finite / non-number", () => {
    expect(round(NaN)).toBeNull();
    expect(round("x")).toBeNull();
    expect(round(undefined)).toBeNull();
  });
});

describe("constants", () => {
  it("exposes the frozen period and interval lists", () => {
    expect(PERIODS).toContain("max");
    expect(INTERVALS).toContain("1d");
  });
});

import { describe, expect, it } from "vitest";
import { isNotFound, normalizeError } from "../src/yahoo.js";

describe("isNotFound", () => {
  it("is true for 'not found' messages", () => {
    expect(isNotFound(new Error("Quote not found for ticker symbol: ZZZZ"))).toBe(true);
  });
  it("is true for 'No data found'", () => {
    expect(isNotFound(new Error("No data found, symbol may be delisted"))).toBe(true);
  });
  it("is true for an HTTP 404-shaped error", () => {
    const e = Object.assign(new Error("Request failed"), { response: { status: 404 } });
    expect(isNotFound(e)).toBe(true);
  });
  it("is false for other errors and non-errors", () => {
    expect(isNotFound(new Error("network timeout"))).toBe(false);
    expect(isNotFound("nope")).toBe(false);
  });
});

describe("normalizeError", () => {
  it("maps not-found to a structured message with the symbol", () => {
    expect(normalizeError(new Error("Quote not found"), "ZZZZ")).toEqual({
      error: "symbol not found",
      symbol: "ZZZZ",
    });
  });
  it("passes through other error messages", () => {
    expect(normalizeError(new Error("boom"))).toEqual({ error: "boom" });
  });
  it("stringifies non-Error throws", () => {
    expect(normalizeError("weird")).toEqual({ error: "weird" });
  });
});

import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { getMultipleQuotes } from "../../src/tools/getMultipleQuotes.js";
import { autoRestore } from "../helpers.js";

autoRestore();

describe("get_multiple_quotes", () => {
  it("keys results by symbol and rounds", async () => {
    vi.spyOn(yf, "quote").mockResolvedValue([
      { symbol: "AAPL", regularMarketPrice: 231.239, regularMarketChange: 1.234,
        regularMarketChangePercent: 0.536, currency: "USD", marketState: "REGULAR", longName: "Apple Inc." },
      { symbol: "MSFT", regularMarketPrice: 420.1, regularMarketChange: -2.0,
        regularMarketChangePercent: -0.47, currency: "USD", marketState: "REGULAR", longName: "Microsoft" },
    ]);
    const out = (await getMultipleQuotes.handler({ symbols: ["AAPL", "MSFT"] })) as {
      quotes: Record<string, { price: number }>; errors: Record<string, string>;
    };
    expect(out.quotes.AAPL!.price).toBe(231.24);
    expect(out.quotes.MSFT!.price).toBe(420.1);
    expect(out.errors).toEqual({});
  });

  it("matches symbols case-insensitively against Yahoo's upper-cased response", async () => {
    vi.spyOn(yf, "quote").mockResolvedValue([
      { symbol: "AAPL", regularMarketPrice: 231, currency: "USD", marketState: "REGULAR" },
    ]);
    const out = (await getMultipleQuotes.handler({ symbols: ["aapl"] })) as {
      quotes: Record<string, { price: number }>; errors: Record<string, string>;
    };
    expect(out.quotes.aapl!.price).toBe(231);
    expect(out.errors).toEqual({});
  });

  it("records symbols missing from the response under errors", async () => {
    vi.spyOn(yf, "quote").mockResolvedValue([
      { symbol: "AAPL", regularMarketPrice: 231, currency: "USD", marketState: "REGULAR" },
    ]);
    const out = (await getMultipleQuotes.handler({ symbols: ["AAPL", "ZZZZ"] })) as {
      errors: Record<string, string>;
    };
    expect(out.errors.ZZZZ).toMatch(/no quote/i);
  });

  it("maps a total failure to a structured error", async () => {
    vi.spyOn(yf, "quote").mockRejectedValue(new Error("network down"));
    const out = await getMultipleQuotes.handler({ symbols: ["AAPL"] });
    expect(out).toEqual({ error: "network down" });
  });
});

import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { getStockInfo } from "../../src/tools/getStockInfo.js";
import { autoRestore } from "../helpers.js";

autoRestore();

describe("get_stock_info", () => {
  it("flattens quote + quoteSummary into a snapshot", async () => {
    vi.spyOn(yf, "quote").mockResolvedValue({
      regularMarketPrice: 231.2, currency: "USD", longName: "Apple Inc.",
      fullExchangeName: "NasdaqGS",
    });
    vi.spyOn(yf, "quoteSummary").mockResolvedValue({
      price: { marketCap: 3_500_000_000_000 },
      summaryDetail: {
        trailingPE: 35.1, forwardPE: 30.2, fiftyTwoWeekHigh: 260, fiftyTwoWeekLow: 164,
        dividendYield: 0.0044, beta: 1.2,
      },
      assetProfile: {
        sector: "Technology", industry: "Consumer Electronics",
        fullTimeEmployees: 164000, website: "https://apple.com",
        longBusinessSummary: "Apple designs...",
      },
    });

    const out = (await getStockInfo.handler({ symbol: "AAPL" })) as Record<string, unknown>;
    expect(out).toMatchObject({
      symbol: "AAPL", price: 231.2, currency: "USD", marketCap: 3_500_000_000_000,
      trailingPE: 35.1, sector: "Technology", employees: 164000, longName: "Apple Inc.",
      exchange: "NasdaqGS",
    });
    expect(yf.quoteSummary).toHaveBeenCalledWith("AAPL", expect.arrayContaining(["assetProfile", "summaryDetail", "price"]));
  });

  it("returns a structured not-found error", async () => {
    vi.spyOn(yf, "quote").mockRejectedValue(new Error("Quote not found for ticker symbol: ZZZZ"));
    vi.spyOn(yf, "quoteSummary").mockRejectedValue(new Error("Quote not found"));
    const out = await getStockInfo.handler({ symbol: "ZZZZ" });
    expect(out).toEqual({ error: "symbol not found", symbol: "ZZZZ" });
  });
});

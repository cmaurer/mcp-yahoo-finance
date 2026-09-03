import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { searchStocks } from "../../src/tools/searchStocks.js";
import { autoRestore } from "../helpers.js";

autoRestore();

describe("search_stocks", () => {
  it("maps quotes from search() and passes the limit", async () => {
    const spy = vi.spyOn(yf, "search").mockResolvedValue({
      quotes: [
        { symbol: "AAPL", shortname: "Apple Inc.", exchange: "NMS", quoteType: "EQUITY", score: 12345, isYahooFinance: true },
        { symbol: "APLE", shortname: "Apple Hospitality", exchange: "NYQ", quoteType: "EQUITY", score: 900, isYahooFinance: true },
        { name: "Not a security", isYahooFinance: false },
      ],
    } as never);
    const out = (await searchStocks.handler({ query: "apple", limit: 5 })) as any;
    expect(out.results).toEqual([
      { symbol: "AAPL", name: "Apple Inc.", exchange: "NMS", type: "EQUITY", score: 12345 },
      { symbol: "APLE", name: "Apple Hospitality", exchange: "NYQ", type: "EQUITY", score: 900 },
    ]);
    expect(spy).toHaveBeenCalledWith("apple", expect.objectContaining({ quotesCount: 5, newsCount: 0 }));
  });
});

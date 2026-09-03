import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { getTrendingSymbols } from "../../src/tools/getTrendingSymbols.js";
import { autoRestore } from "../helpers.js";

autoRestore();

describe("get_trending_symbols", () => {
  it("maps trending quotes and passes region + count", async () => {
    const spy = vi.spyOn(yf, "trendingSymbols").mockResolvedValue({
      count: 2,
      quotes: [
        { symbol: "NVDA", shortName: "NVIDIA", regularMarketPrice: 120.5, regularMarketChangePercent: 3.2 },
        { symbol: "TSLA", shortName: "Tesla", regularMarketPrice: 240.1, regularMarketChangePercent: -1.1 },
      ],
    } as never);
    const out = (await getTrendingSymbols.handler({ region: "US", count: 2 })) as any;
    expect(out.region).toBe("US");
    expect(out.quotes).toEqual([
      { symbol: "NVDA", shortName: "NVIDIA", price: 120.5, changePercent: 3.2 },
      { symbol: "TSLA", shortName: "Tesla", price: 240.1, changePercent: -1.1 },
    ]);
    expect(spy).toHaveBeenCalledWith("US", expect.objectContaining({ count: 2 }));
  });
});

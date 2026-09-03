import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { getTrendingSymbols } from "../../src/tools/getTrendingSymbols.js";
import { autoRestore } from "../helpers.js";

autoRestore();

describe("get_trending_symbols", () => {
  it("enriches symbol-only trending rows with a batched quote lookup", async () => {
    const trendingSpy = vi.spyOn(yf, "trendingSymbols").mockResolvedValue({
      count: 2,
      quotes: [{ symbol: "NVDA" }, { symbol: "TSLA" }],
    } as never);
    const quoteSpy = vi.spyOn(yf, "quote").mockResolvedValue([
      { symbol: "NVDA", longName: "NVIDIA", regularMarketPrice: 120.5, regularMarketChangePercent: 3.2 },
      { symbol: "TSLA", shortName: "Tesla", regularMarketPrice: 240.1, regularMarketChangePercent: -1.1 },
    ] as never);

    const out = (await getTrendingSymbols.handler({ region: "US", count: 2 })) as any;
    expect(out.region).toBe("US");
    expect(out.quotes).toEqual([
      { symbol: "NVDA", shortName: "NVIDIA", price: 120.5, changePercent: 3.2 },
      { symbol: "TSLA", shortName: "Tesla", price: 240.1, changePercent: -1.1 },
    ]);
    expect(trendingSpy).toHaveBeenCalledWith("US", expect.objectContaining({ count: 2 }));
    expect(quoteSpy).toHaveBeenCalledWith(["NVDA", "TSLA"]);
  });

  it("falls back to bare symbols when the quote enrichment call fails", async () => {
    vi.spyOn(yf, "trendingSymbols").mockResolvedValue({
      quotes: [{ symbol: "NVDA" }, { symbol: "TSLA" }],
    } as never);
    vi.spyOn(yf, "quote").mockRejectedValue(new Error("network blew up"));

    const out = (await getTrendingSymbols.handler({ region: "US", count: 10 })) as any;
    expect(out).toEqual({
      region: "US",
      quotes: [
        { symbol: "NVDA", shortName: null, price: null, changePercent: null },
        { symbol: "TSLA", shortName: null, price: null, changePercent: null },
      ],
    });
  });

  it("returns an empty list and skips enrichment when nothing is trending", async () => {
    vi.spyOn(yf, "trendingSymbols").mockResolvedValue({ quotes: [] } as never);
    const quoteSpy = vi.spyOn(yf, "quote").mockResolvedValue([] as never);

    const out = (await getTrendingSymbols.handler({ region: "US", count: 5 })) as any;
    expect(out).toEqual({ region: "US", quotes: [] });
    expect(quoteSpy).not.toHaveBeenCalled();
  });
});

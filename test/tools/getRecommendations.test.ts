import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { getRecommendations } from "../../src/tools/getRecommendations.js";
import { autoRestore } from "../helpers.js";

autoRestore();

describe("get_recommendations", () => {
  it("maps recommendationTrend rows", async () => {
    vi.spyOn(yf, "quoteSummary").mockResolvedValue({
      recommendationTrend: {
        trend: [
          { period: "0m", strongBuy: 10, buy: 20, hold: 5, sell: 1, strongSell: 0 },
          { period: "-1m", strongBuy: 9, buy: 19, hold: 6, sell: 1, strongSell: 0 },
        ],
      },
    } as never);
    const out = (await getRecommendations.handler({ symbol: "AAPL" })) as any;
    expect(out.symbol).toBe("AAPL");
    expect(out.trend).toHaveLength(2);
    expect(out.trend[0]).toEqual({ period: "0m", strongBuy: 10, buy: 20, hold: 5, sell: 1, strongSell: 0 });
    expect(out.note).toMatch(/analyst/i);
  });

  it("returns an empty trend when the module is missing", async () => {
    vi.spyOn(yf, "quoteSummary").mockResolvedValue({} as never);
    const out = (await getRecommendations.handler({ symbol: "AAPL" })) as any;
    expect(out.trend).toEqual([]);
  });
});

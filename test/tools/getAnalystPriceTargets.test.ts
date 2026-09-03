import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { getAnalystPriceTargets } from "../../src/tools/getAnalystPriceTargets.js";
import { autoRestore } from "../helpers.js";

autoRestore();

describe("get_analyst_price_targets", () => {
  it("extracts targets from financialData", async () => {
    vi.spyOn(yf, "quoteSummary").mockResolvedValue({
      financialData: {
        currentPrice: 231.2, targetMeanPrice: 250, targetHighPrice: 300, targetLowPrice: 180,
        targetMedianPrice: 245, numberOfAnalystOpinions: 40, recommendationKey: "buy",
        recommendationMean: 2.1,
      },
    });
    const out = (await getAnalystPriceTargets.handler({ symbol: "AAPL" })) as Record<string, unknown>;
    expect(out).toMatchObject({
      symbol: "AAPL", current: 231.2, targetMean: 250, targetHigh: 300, targetLow: 180,
      numberOfAnalysts: 40, recommendationKey: "buy",
    });
  });

  it("returns nulls when financialData is absent", async () => {
    vi.spyOn(yf, "quoteSummary").mockResolvedValue({});
    const out = (await getAnalystPriceTargets.handler({ symbol: "AAPL" })) as Record<string, unknown>;
    expect(out).toMatchObject({ symbol: "AAPL", targetMean: null, numberOfAnalysts: null });
  });
});

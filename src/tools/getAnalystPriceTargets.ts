import { z } from "zod";
import { defineTool } from "../types.js";
import { yf, isNotFound } from "../yahoo.js";
import { round } from "../format.js";

export const getAnalystPriceTargets = defineTool({
  name: "get_analyst_price_targets",
  title: "Get analyst price targets",
  description: "Wall Street price targets and consensus rating for a ticker.",
  inputSchema: { symbol: z.string().describe("Ticker symbol") },
  handler: async ({ symbol }) => {
    try {
      // yf.quoteSummary is typed `unknown` (validateResult:false overload); the
      // raw payload resembles QuoteSummaryResult.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = (await yf.quoteSummary(symbol, ["financialData"])) as any;
      const f = s?.financialData ?? {};
      return {
        symbol,
        current: round(f.currentPrice) ?? null,
        targetMean: round(f.targetMeanPrice) ?? null,
        targetHigh: round(f.targetHighPrice) ?? null,
        targetLow: round(f.targetLowPrice) ?? null,
        targetMedian: round(f.targetMedianPrice) ?? null,
        numberOfAnalysts: f.numberOfAnalystOpinions ?? null,
        recommendationKey: f.recommendationKey ?? null,
        recommendationMean: round(f.recommendationMean) ?? null,
      };
    } catch (err) {
      if (isNotFound(err)) return { error: "symbol not found", symbol };
      throw err;
    }
  },
});

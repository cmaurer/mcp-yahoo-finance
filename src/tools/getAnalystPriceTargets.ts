import { z } from "zod";
import { defineTool } from "../types.js";
import { yf } from "../yahoo.js";
import { round } from "../format.js";

export const getAnalystPriceTargets = defineTool({
  name: "get_analyst_price_targets",
  title: "Get analyst price targets",
  description: "Wall Street price targets and consensus rating for a ticker.",
  inputSchema: { symbol: z.string().describe("Ticker symbol") },
  handler: async ({ symbol }) => {
    // Raw payload resembles QuoteSummaryResult (typed `any` by the wrapper).
    const s = await yf.quoteSummary(symbol, ["financialData"]);
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
  },
});

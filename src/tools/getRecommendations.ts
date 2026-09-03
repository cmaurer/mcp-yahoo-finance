import { z } from "zod";
import { defineTool } from "../types.js";
import { yf, isNotFound } from "../yahoo.js";

export const getRecommendations = defineTool({
  name: "get_recommendations",
  title: "Get analyst recommendations",
  description: "Analyst rating counts (strong buy / buy / hold / sell / strong sell) by period.",
  inputSchema: { symbol: z.string().describe("Ticker symbol") },
  handler: async ({ symbol }) => {
    try {
      const s = await yf.quoteSummary(symbol, ["recommendationTrend"]);
      const trend = (s?.recommendationTrend?.trend ?? []).map((t: any) => ({
        period: t.period ?? null,
        strongBuy: t.strongBuy ?? 0,
        buy: t.buy ?? 0,
        hold: t.hold ?? 0,
        sell: t.sell ?? 0,
        strongSell: t.strongSell ?? 0,
      }));
      return {
        symbol,
        trend,
        note: "Counts are the number of analysts at each rating for the given period offset.",
      };
    } catch (err) {
      if (isNotFound(err)) return { error: "symbol not found", symbol };
      throw err;
    }
  },
});

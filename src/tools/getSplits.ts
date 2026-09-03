import { z } from "zod";
import { defineTool } from "../types.js";
import { yf, isNotFound } from "../yahoo.js";
import { toISODate, round } from "../format.js";

function asList(events: any): any[] {
  if (!events) return [];
  return Array.isArray(events) ? events : Object.values(events);
}

export const getSplits = defineTool({
  name: "get_splits",
  title: "Get stock split history",
  description: "Full stock-split history for a ticker.",
  inputSchema: { symbol: z.string().describe("Ticker symbol") },
  handler: async ({ symbol }) => {
    try {
      const res = await yf.chart(symbol, { period1: new Date(0), events: "splits" });
      const splits = asList(res?.events?.splits)
        .map((s: any) => {
          const numerator = s.numerator ?? null;
          const denominator = s.denominator ?? null;
          return {
            date: toISODate(s.date),
            numerator,
            denominator,
            ratio: numerator && denominator ? round(numerator / denominator, 4) : null,
          };
        })
        .filter((s) => s.date !== null);
      return { symbol, splits, count: splits.length };
    } catch (err) {
      if (isNotFound(err)) return { error: "symbol not found", symbol };
      throw err;
    }
  },
});

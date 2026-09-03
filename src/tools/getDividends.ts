import { z } from "zod";
import { defineTool } from "../types.js";
import { yf } from "../yahoo.js";
import { toISODate, round } from "../format.js";

function asList(events: any): any[] {
  if (!events) return [];
  return Array.isArray(events) ? events : Object.values(events);
}

export const getDividends = defineTool({
  name: "get_dividends",
  title: "Get dividend history",
  description: "Full dividend payment history for a ticker.",
  inputSchema: { symbol: z.string().describe("Ticker symbol") },
  handler: async ({ symbol }) => {
    const res = await yf.chart(symbol, { period1: new Date(0), events: "dividends" });
    const dividends = asList(res?.events?.dividends)
      .map((d: any) => ({ date: toISODate(d.date), amount: round(d.amount, 4) }))
      .filter((d) => d.date !== null);
    return { symbol, dividends, count: dividends.length };
  },
});

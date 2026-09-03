import { z } from "zod";
import { defineTool } from "../types.js";
import { yf } from "../yahoo.js";
import { toISODate, round } from "../format.js";

export const getEarnings = defineTool({
  name: "get_earnings",
  title: "Get earnings",
  description: "Quarterly EPS actual vs estimate, yearly revenue/earnings, and next report date.",
  inputSchema: { symbol: z.string().describe("Ticker symbol") },
  handler: async ({ symbol }) => {
    const s = await yf.quoteSummary(symbol, ["earnings", "calendarEvents"]);
    const quarterly = (s?.earnings?.earningsChart?.quarterly ?? []).map((q: any) => ({
      date: q?.date ?? null,
      actual: round(q?.actual, 4),
      estimate: round(q?.estimate, 4),
    }));
    const yearly = (s?.earnings?.financialsChart?.yearly ?? []).map((y: any) => ({
      year: y?.date ?? null,
      revenue: y?.revenue ?? null,
      earnings: y?.earnings ?? null,
    }));
    const rawNext = s?.calendarEvents?.earnings?.earningsDate?.[0] ?? null;
    return { symbol, quarterly, yearly, nextEarningsDate: toISODate(rawNext) };
  },
});

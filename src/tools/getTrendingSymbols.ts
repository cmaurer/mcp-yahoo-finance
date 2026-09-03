import { z } from "zod";
import { defineTool } from "../types.js";
import { yf } from "../yahoo.js";
import { round } from "../format.js";

export const getTrendingSymbols = defineTool({
  name: "get_trending_symbols",
  title: "Get trending symbols",
  description: "Most-active / trending tickers for a region.",
  inputSchema: {
    region: z.string().default("US").describe("Region code, e.g. US, GB, DE"),
    count: z.number().int().min(1).max(50).default(10).describe("Max symbols"),
  },
  handler: async ({ region, count }) => {
    const res = await yf.trendingSymbols(region, { count });
    const quotes = (res?.quotes ?? []).slice(0, count).map((q: any) => ({
      symbol: q.symbol,
      shortName: q.shortName ?? q.longName ?? null,
      price: round(q.regularMarketPrice),
      changePercent: round(q.regularMarketChangePercent),
    }));
    return { region, quotes };
  },
});

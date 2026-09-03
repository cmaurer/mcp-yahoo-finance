import { z } from "zod";
import { defineTool } from "../types.js";
import { yf } from "../yahoo.js";

export const searchStocks = defineTool({
  name: "search_stocks",
  title: "Search stocks",
  description: "Look up tickers and companies by name or symbol.",
  inputSchema: {
    query: z.string().describe("Search text"),
    limit: z.number().int().min(1).max(50).default(10).describe("Max results"),
  },
  handler: async ({ query, limit }) => {
    const res = await yf.search(query, { quotesCount: limit, newsCount: 0 });
    const results = (res?.quotes ?? [])
      .filter((q: any) => q?.symbol)
      .slice(0, limit)
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortname ?? q.longname ?? q.shortName ?? null,
        exchange: q.exchange ?? null,
        type: q.quoteType ?? q.typeDisp ?? null,
        score: q.score ?? null,
      }));
    return { query, results };
  },
});

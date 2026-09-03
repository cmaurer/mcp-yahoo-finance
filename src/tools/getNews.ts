import { z } from "zod";
import { defineTool } from "../types.js";
import { yf } from "../yahoo.js";
import { toISODateTime } from "../format.js";

export const getNews = defineTool({
  name: "get_news",
  title: "Get news",
  description: "Recent news articles related to a ticker.",
  inputSchema: {
    symbol: z.string().describe("Ticker symbol"),
    count: z.number().int().min(1).max(50).default(10).describe("Max articles"),
  },
  handler: async ({ symbol, count }) => {
    const res = await yf.search(symbol, { newsCount: count, quotesCount: 0 });
    const articles = (res?.news ?? []).slice(0, count).map((n: any) => ({
      title: n.title ?? null,
      publisher: n.publisher ?? null,
      link: n.link ?? null,
      publishedAt: toISODateTime(n.providerPublishTime),
      type: n.type ?? null,
      relatedTickers: n.relatedTickers ?? [],
    }));
    return { symbol, articles };
  },
});

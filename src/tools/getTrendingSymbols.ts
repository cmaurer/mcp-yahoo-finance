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
    // yahoo-finance2 v4 returns symbol-only rows here: { quotes: [{ symbol }] }.
    const symbols: string[] = ((res?.quotes ?? []) as any[])
      .map((q) => q?.symbol)
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .slice(0, count);

    // Best-effort enrichment: one batched quote call for name + price fields.
    const bySymbol = new Map<string, any>();
    if (symbols.length > 0) {
      try {
        const rows = await yf.quote(symbols);
        for (const r of (Array.isArray(rows) ? rows : [rows]) as any[]) {
          if (r?.symbol) bySymbol.set(r.symbol, r);
        }
      } catch {
        // Enrichment failed — fall back to bare symbols with null fields.
      }
    }

    const quotes = symbols.map((symbol) => {
      const q = bySymbol.get(symbol);
      return {
        symbol,
        shortName: q?.longName ?? q?.shortName ?? null,
        price: round(q?.regularMarketPrice),
        changePercent: round(q?.regularMarketChangePercent),
      };
    });

    return { region, quotes };
  },
});

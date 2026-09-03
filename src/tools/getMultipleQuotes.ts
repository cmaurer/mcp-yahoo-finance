import { z } from "zod";
import { defineTool } from "../types.js";
import { yf } from "../yahoo.js";
import { round } from "../format.js";

export const getMultipleQuotes = defineTool({
  name: "get_multiple_quotes",
  title: "Get multiple quotes",
  description: "Batch current-quote lookup for several tickers.",
  inputSchema: { symbols: z.array(z.string()).min(1).describe("Ticker symbols") },
  handler: async ({ symbols }) => {
    let rows: any[];
    try {
      const res = await yf.quote(symbols);
      rows = Array.isArray(res) ? res : [res];
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
    // Yahoo upper-cases symbols in its response, so match case-insensitively.
    const bySymbol = new Map<string, any>(
      rows.filter(Boolean).map((r) => [String(r.symbol).toUpperCase(), r]),
    );
    const quotes: Record<string, unknown> = {};
    const errors: Record<string, string> = {};
    for (const sym of symbols) {
      const r = bySymbol.get(sym.toUpperCase());
      if (!r) {
        errors[sym] = "no quote returned";
        continue;
      }
      quotes[sym] = {
        price: round(r.regularMarketPrice),
        change: round(r.regularMarketChange),
        changePercent: round(r.regularMarketChangePercent),
        currency: r.currency ?? null,
        marketState: r.marketState ?? null,
        longName: r.longName ?? r.shortName ?? null,
      };
    }
    return { quotes, errors };
  },
});

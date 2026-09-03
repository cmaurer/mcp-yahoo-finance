import { z } from "zod";
import { defineTool } from "../types.js";
import { yf, isNotFound } from "../yahoo.js";
import { round } from "../format.js";

const MODULES = ["assetProfile", "summaryDetail", "price", "financialData", "defaultKeyStatistics"];

export const getStockInfo = defineTool({
  name: "get_stock_info",
  title: "Get stock info",
  description: "Current price, valuation, and company profile for a ticker.",
  inputSchema: { symbol: z.string().describe("Ticker symbol, e.g. AAPL") },
  handler: async ({ symbol }) => {
    try {
      // yf.quote / yf.quoteSummary are typed `any` / `unknown` (validateResult:false
      // overloads); the raw payloads resemble Quote / QuoteSummaryResult.
      const [q, s] = (await Promise.all([
        yf.quote(symbol),
        yf.quoteSummary(symbol, MODULES),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ])) as [any, any];
      const sd = s?.summaryDetail ?? {};
      const ap = s?.assetProfile ?? {};
      return {
        symbol,
        price: round(q?.regularMarketPrice) ?? round(s?.price?.regularMarketPrice),
        currency: q?.currency ?? s?.price?.currency ?? null,
        longName: q?.longName ?? s?.price?.longName ?? null,
        exchange: q?.fullExchangeName ?? s?.price?.exchangeName ?? null,
        marketCap: s?.price?.marketCap ?? sd.marketCap ?? null,
        trailingPE: round(sd.trailingPE) ?? null,
        forwardPE: round(sd.forwardPE) ?? null,
        fiftyTwoWeekHigh: round(sd.fiftyTwoWeekHigh) ?? null,
        fiftyTwoWeekLow: round(sd.fiftyTwoWeekLow) ?? null,
        dividendYield: sd.dividendYield ?? null,
        beta: round(sd.beta) ?? null,
        sector: ap.sector ?? null,
        industry: ap.industry ?? null,
        employees: ap.fullTimeEmployees ?? null,
        website: ap.website ?? null,
        description: ap.longBusinessSummary ?? null,
      };
    } catch (err) {
      if (isNotFound(err)) return { error: "symbol not found", symbol };
      throw err;
    }
  },
});

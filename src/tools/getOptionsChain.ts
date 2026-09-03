import { z } from "zod";
import { defineTool } from "../types.js";
import { yf } from "../yahoo.js";
import { toISODate, round } from "../format.js";

function contract(c: any, expiration: string | null) {
  return {
    contractSymbol: c.contractSymbol ?? null,
    strike: round(c.strike, 4),
    lastPrice: round(c.lastPrice, 4),
    bid: round(c.bid, 4),
    ask: round(c.ask, 4),
    volume: c.volume ?? null,
    openInterest: c.openInterest ?? null,
    impliedVolatility: round(c.impliedVolatility, 4),
    inTheMoney: c.inTheMoney ?? null,
    expiration,
  };
}

export const getOptionsChain = defineTool({
  name: "get_options_chain",
  title: "Get options chain",
  description: "Calls and puts for a ticker at the nearest (or a given) expiration.",
  inputSchema: {
    symbol: z.string().describe("Ticker symbol"),
    date: z.string().optional().describe("Expiration date (YYYY-MM-DD); omit for nearest"),
  },
  handler: async ({ symbol, date }) => {
    const query = date ? { date: new Date(`${date}T00:00:00Z`) } : {};
    const res = await yf.options(symbol, query);
    const expirationDates: (string | null)[] = (res?.expirationDates ?? []).map((d: any) =>
      toISODate(d),
    );
    const chain = res?.options?.[0] ?? {};
    const selectedExpiration = toISODate(chain.expirationDate) ?? expirationDates[0] ?? null;
    return {
      symbol,
      expirationDates,
      selectedExpiration,
      calls: (chain.calls ?? []).map((c: any) => contract(c, selectedExpiration)),
      puts: (chain.puts ?? []).map((p: any) => contract(p, selectedExpiration)),
    };
  },
});

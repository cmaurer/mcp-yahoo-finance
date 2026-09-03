import { z } from "zod";
import { defineTool } from "../types.js";
import { yf } from "../yahoo.js";
import { PERIODS, INTERVALS, periodToRange, toISODate, round } from "../format.js";

export const getHistoricalData = defineTool({
  name: "get_historical_data",
  title: "Get historical price data",
  description: "OHLCV history for a ticker over a period at an interval.",
  inputSchema: {
    symbol: z.string().describe("Ticker symbol"),
    period: z.enum(PERIODS).default("1mo").describe("Look-back window"),
    interval: z.enum(INTERVALS).default("1d").describe("Bar size"),
  },
  handler: async ({ symbol, period, interval }) => {
    const { period1, period2 } = periodToRange(period);
    const res = await yf.chart(symbol, { period1, period2, interval });
    const rows = (res?.quotes ?? []).map((q: any) => ({
      date: toISODate(q.date),
      open: round(q.open),
      high: round(q.high),
      low: round(q.low),
      close: round(q.close),
      adjClose: round(q.adjclose ?? q.adjClose),
      volume: q.volume ?? null,
    }));
    const m = res?.meta ?? {};
    return {
      symbol,
      period,
      interval,
      rows,
      count: rows.length,
      meta: {
        currency: m.currency ?? null,
        exchangeName: m.exchangeName ?? null,
        instrumentType: m.instrumentType ?? null,
      },
    };
  },
});

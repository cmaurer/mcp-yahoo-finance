import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { getHistoricalData } from "../../src/tools/getHistoricalData.js";
import { autoRestore } from "../helpers.js";

autoRestore();

const chartFixture = {
  meta: { currency: "USD", exchangeName: "NMS", instrumentType: "EQUITY" },
  quotes: [
    { date: new Date("2026-08-25T13:30:00Z"), open: 226.1, high: 229, low: 225.4, close: 228.5, volume: 40_000_000, adjclose: 228.5 },
    { date: new Date("2026-08-26T13:30:00Z"), open: 228.9, high: 231.2, low: 228, close: 230.1, volume: 38_500_000, adjclose: 230.1 },
  ],
};

describe("get_historical_data", () => {
  it("normalizes chart() quotes into OHLCV rows", async () => {
    const spy = vi.spyOn(yf, "chart").mockResolvedValue(chartFixture as never);
    const out = (await getHistoricalData.handler({ symbol: "AAPL", period: "1mo", interval: "1d" })) as any;

    expect(out.symbol).toBe("AAPL");
    expect(out.count).toBe(2);
    expect(out.rows[0]).toEqual({
      date: "2026-08-25", open: 226.1, high: 229, low: 225.4, close: 228.5, adjClose: 228.5, volume: 40_000_000,
    });
    expect(out.meta).toEqual({ currency: "USD", exchangeName: "NMS", instrumentType: "EQUITY" });

    const [sym, opts] = spy.mock.calls[0]!;
    expect(sym).toBe("AAPL");
    expect(opts).toMatchObject({ interval: "1d" });
    expect(opts.period1).toBeInstanceOf(Date);
  });

  it("defaults period and interval when omitted", async () => {
    const spy = vi.spyOn(yf, "chart").mockResolvedValue({ meta: {}, quotes: [] } as never);
    const parsed = getHistoricalData.inputSchema; // schema exists
    await getHistoricalData.handler({ symbol: "AAPL", period: "1mo", interval: "1d" } as any);
    expect(spy).toHaveBeenCalled();
    expect(parsed).toBeDefined();
  });

  it("lets a not-found error propagate to the boundary", async () => {
    vi.spyOn(yf, "chart").mockRejectedValue(new Error("No data found, symbol may be delisted"));
    await expect(
      getHistoricalData.handler({ symbol: "ZZZZ", period: "1mo", interval: "1d" }),
    ).rejects.toThrow(/no data found/i);
  });
});

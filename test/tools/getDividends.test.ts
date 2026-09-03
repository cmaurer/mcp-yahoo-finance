import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { getDividends } from "../../src/tools/getDividends.js";
import { autoRestore } from "../helpers.js";

autoRestore();

describe("get_dividends", () => {
  it("extracts dividend events from chart()", async () => {
    vi.spyOn(yf, "chart").mockResolvedValue({
      meta: {}, quotes: [],
      events: {
        dividends: [
          { date: new Date("2026-05-10T00:00:00Z"), amount: 0.25 },
          { date: new Date("2026-08-10T00:00:00Z"), amount: 0.26 },
        ],
      },
    } as never);
    const out = (await getDividends.handler({ symbol: "AAPL" })) as any;
    expect(out).toEqual({
      symbol: "AAPL",
      dividends: [
        { date: "2026-05-10", amount: 0.25 },
        { date: "2026-08-10", amount: 0.26 },
      ],
      count: 2,
    });
    const [, opts] = (yf.chart as any).mock.calls[0];
    expect(opts).toMatchObject({ events: "dividends" });
    expect(opts.period1.getTime()).toBe(0); // full history
  });

  it("handles an object-keyed events map and no dividends", async () => {
    vi.spyOn(yf, "chart").mockResolvedValue({ meta: {}, quotes: [], events: {} } as never);
    const out = (await getDividends.handler({ symbol: "AAPL" })) as any;
    expect(out).toEqual({ symbol: "AAPL", dividends: [], count: 0 });
  });
});

import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { getOptionsChain } from "../../src/tools/getOptionsChain.js";
import { autoRestore } from "../helpers.js";

autoRestore();

const optFixture = {
  expirationDates: [new Date("2026-09-19T00:00:00Z"), new Date("2026-10-17T00:00:00Z")],
  options: [
    {
      expirationDate: new Date("2026-09-19T00:00:00Z"),
      calls: [
        { contractSymbol: "AAPL260919C00230000", strike: 230, lastPrice: 5.4, bid: 5.3, ask: 5.5, volume: 1200, openInterest: 8000, impliedVolatility: 0.28, inTheMoney: true },
      ],
      puts: [
        { contractSymbol: "AAPL260919P00230000", strike: 230, lastPrice: 4.1, bid: 4.0, ask: 4.2, volume: 900, openInterest: 6000, impliedVolatility: 0.30, inTheMoney: false },
      ],
    },
  ],
};

describe("get_options_chain", () => {
  it("returns the nearest expiry when no date is given", async () => {
    const spy = vi.spyOn(yf, "options").mockResolvedValue(optFixture as never);
    const out = (await getOptionsChain.handler({ symbol: "AAPL" })) as any;
    expect(out.symbol).toBe("AAPL");
    expect(out.expirationDates).toEqual(["2026-09-19", "2026-10-17"]);
    expect(out.selectedExpiration).toBe("2026-09-19");
    expect(out.calls[0]).toMatchObject({ strike: 230, lastPrice: 5.4, inTheMoney: true, expiration: "2026-09-19" });
    expect(out.puts[0]).toMatchObject({ strike: 230, inTheMoney: false });
    expect(spy).toHaveBeenCalledWith("AAPL", {});
  });

  it("passes a requested expiration date through", async () => {
    const spy = vi.spyOn(yf, "options").mockResolvedValue(optFixture as never);
    await getOptionsChain.handler({ symbol: "AAPL", date: "2026-10-17" });
    const [, opts] = spy.mock.calls[0]!;
    expect(opts).toMatchObject({ date: expect.any(Date) });
    expect((opts as any).date.toISOString().slice(0, 10)).toBe("2026-10-17");
  });
});

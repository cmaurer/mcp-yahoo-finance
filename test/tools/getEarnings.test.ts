import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { getEarnings } from "../../src/tools/getEarnings.js";
import { autoRestore } from "../helpers.js";

autoRestore();

describe("get_earnings", () => {
  it("summarizes quarterly EPS, yearly revenue/earnings, and next date", async () => {
    vi.spyOn(yf, "quoteSummary").mockResolvedValue({
      earnings: {
        earningsChart: {
          quarterly: [
            { date: "2Q2026", actual: 1.4, estimate: 1.35 },
            { date: "3Q2026", actual: 1.6, estimate: 1.55 },
          ],
        },
        financialsChart: {
          yearly: [
            { date: 2024, revenue: 383_000_000_000, earnings: 97_000_000_000 },
            { date: 2025, revenue: 400_000_000_000, earnings: 100_000_000_000 },
          ],
        },
      },
      calendarEvents: { earnings: { earningsDate: [new Date("2026-10-30T00:00:00Z")] } },
    } as never);

    const out = (await getEarnings.handler({ symbol: "AAPL" })) as any;
    expect(out.symbol).toBe("AAPL");
    expect(out.quarterly).toEqual([
      { date: "2Q2026", actual: 1.4, estimate: 1.35 },
      { date: "3Q2026", actual: 1.6, estimate: 1.55 },
    ]);
    expect(out.yearly).toEqual([
      { year: 2024, revenue: 383_000_000_000, earnings: 97_000_000_000 },
      { year: 2025, revenue: 400_000_000_000, earnings: 100_000_000_000 },
    ]);
    expect(out.nextEarningsDate).toBe("2026-10-30");
  });

  it("tolerates missing sections", async () => {
    vi.spyOn(yf, "quoteSummary").mockResolvedValue({} as never);
    const out = (await getEarnings.handler({ symbol: "AAPL" })) as any;
    expect(out).toEqual({ symbol: "AAPL", quarterly: [], yearly: [], nextEarningsDate: null });
  });
});

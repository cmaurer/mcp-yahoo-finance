import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { getSplits } from "../../src/tools/getSplits.js";
import { autoRestore } from "../helpers.js";

autoRestore();

describe("get_splits", () => {
  it("normalizes split events with a computed ratio", async () => {
    vi.spyOn(yf, "chart").mockResolvedValue({
      meta: {}, quotes: [],
      events: {
        splits: [
          { date: new Date("2020-08-31T00:00:00Z"), numerator: 4, denominator: 1, splitRatio: "4:1" },
        ],
      },
    } as never);
    const out = (await getSplits.handler({ symbol: "AAPL" })) as any;
    expect(out).toEqual({
      symbol: "AAPL",
      splits: [{ date: "2020-08-31", numerator: 4, denominator: 1, ratio: 4 }],
      count: 1,
    });
  });

  it("returns an empty list when there are no splits", async () => {
    vi.spyOn(yf, "chart").mockResolvedValue({ meta: {}, quotes: [] } as never);
    const out = (await getSplits.handler({ symbol: "AAPL" })) as any;
    expect(out).toEqual({ symbol: "AAPL", splits: [], count: 0 });
  });
});

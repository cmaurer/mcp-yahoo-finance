import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { getHolders } from "../../src/tools/getHolders.js";
import { autoRestore } from "../helpers.js";

autoRestore();

describe("get_holders", () => {
  it("assembles the four ownership views", async () => {
    vi.spyOn(yf, "quoteSummary").mockResolvedValue({
      majorHoldersBreakdown: { insidersPercentHeld: 0.0007, institutionsPercentHeld: 0.61 },
      institutionOwnership: {
        ownershipList: [{ organization: "Vanguard", pctHeld: 0.084, position: 1_300_000_000, value: 300_000_000_000, reportDate: new Date("2026-06-30T00:00:00Z") }],
      },
      fundOwnership: {
        ownershipList: [{ organization: "VTSAX", pctHeld: 0.03, position: 460_000_000, value: 100_000_000_000, reportDate: new Date("2026-06-30T00:00:00Z") }],
      },
      insiderHolders: {
        holders: [{ name: "COOK TIMOTHY", relation: "CEO", positionDirect: 3_280_000, latestTransDate: new Date("2026-04-01T00:00:00Z") }],
      },
    } as never);

    const out = (await getHolders.handler({ symbol: "AAPL" })) as any;
    expect(out.majorBreakdown).toMatchObject({ insidersPercentHeld: 0.0007, institutionsPercentHeld: 0.61 });
    expect(out.institutional[0]).toMatchObject({ organization: "Vanguard", pctHeld: 0.084, reportDate: "2026-06-30" });
    expect(out.funds[0]).toMatchObject({ organization: "VTSAX" });
    expect(out.insiders[0]).toMatchObject({ name: "COOK TIMOTHY", relation: "CEO", latestTransDate: "2026-04-01" });
  });

  it("returns empty views when modules are missing", async () => {
    vi.spyOn(yf, "quoteSummary").mockResolvedValue({} as never);
    const out = (await getHolders.handler({ symbol: "AAPL" })) as any;
    expect(out).toEqual({ symbol: "AAPL", majorBreakdown: {}, institutional: [], funds: [], insiders: [] });
  });
});

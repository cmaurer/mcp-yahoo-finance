import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { getFinancials } from "../../src/tools/getFinancials.js";
import { autoRestore } from "../helpers.js";

autoRestore();

describe("get_financials", () => {
  it("returns annual statements by default with normalized dates", async () => {
    const spy = vi.spyOn(yf, "quoteSummary").mockResolvedValue({
      incomeStatementHistory: {
        incomeStatementHistory: [{ endDate: new Date("2025-09-28T00:00:00Z"), totalRevenue: 400_000_000_000, netIncome: 100_000_000_000 }],
      },
      balanceSheetHistory: {
        balanceSheetStatements: [{ endDate: new Date("2025-09-28T00:00:00Z"), totalAssets: 350_000_000_000 }],
      },
      cashflowStatementHistory: {
        cashflowStatements: [{ endDate: new Date("2025-09-28T00:00:00Z"), freeCashFlow: 90_000_000_000 }],
      },
    } as never);

    const out = (await getFinancials.handler({ symbol: "AAPL", quarterly: false })) as any;
    expect(out.quarterly).toBe(false);
    expect(out.incomeStatement[0]).toMatchObject({ date: "2025-09-28", totalRevenue: 400_000_000_000 });
    expect(out.balanceSheet[0]).toMatchObject({ date: "2025-09-28", totalAssets: 350_000_000_000 });
    expect(out.cashFlow[0]).toMatchObject({ date: "2025-09-28", freeCashFlow: 90_000_000_000 });
    expect(spy).toHaveBeenCalledWith("AAPL", expect.arrayContaining([
      "incomeStatementHistory", "balanceSheetHistory", "cashflowStatementHistory",
    ]));
  });

  it("requests the quarterly submodules when quarterly=true", async () => {
    const spy = vi.spyOn(yf, "quoteSummary").mockResolvedValue({} as never);
    const out = (await getFinancials.handler({ symbol: "AAPL", quarterly: true })) as any;
    expect(out.quarterly).toBe(true);
    expect(spy).toHaveBeenCalledWith("AAPL", expect.arrayContaining([
      "incomeStatementHistoryQuarterly", "balanceSheetHistoryQuarterly", "cashflowStatementHistoryQuarterly",
    ]));
    expect(out.incomeStatement).toEqual([]);
  });

  it("lets a not-found error propagate to the boundary", async () => {
    vi.spyOn(yf, "quoteSummary").mockRejectedValue(new Error("Quote not found"));
    await expect(getFinancials.handler({ symbol: "ZZZZ", quarterly: false })).rejects.toThrow(
      /not found/i,
    );
  });
});

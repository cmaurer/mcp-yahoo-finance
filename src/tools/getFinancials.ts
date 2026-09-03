import { z } from "zod";
import { defineTool } from "../types.js";
import { yf } from "../yahoo.js";
import { toISODate } from "../format.js";

const ANNUAL = ["incomeStatementHistory", "balanceSheetHistory", "cashflowStatementHistory"];
const QUARTERLY = [
  "incomeStatementHistoryQuarterly",
  "balanceSheetHistoryQuarterly",
  "cashflowStatementHistoryQuarterly",
];

function normalizeRows(rows: any[] | undefined): any[] {
  return (rows ?? []).map((r) => {
    const { endDate, date, ...rest } = r ?? {};
    return { date: toISODate(endDate ?? date), ...rest };
  });
}

export const getFinancials = defineTool({
  name: "get_financials",
  title: "Get financial statements",
  description: "Income statement, balance sheet, and cash flow — annual or quarterly.",
  inputSchema: {
    symbol: z.string().describe("Ticker symbol"),
    quarterly: z.boolean().default(false).describe("Quarterly instead of annual"),
  },
  handler: async ({ symbol, quarterly }) => {
    const modules = quarterly ? QUARTERLY : ANNUAL;
    const s = await yf.quoteSummary(symbol, modules);
    const income = quarterly ? s?.incomeStatementHistoryQuarterly : s?.incomeStatementHistory;
    const balance = quarterly ? s?.balanceSheetHistoryQuarterly : s?.balanceSheetHistory;
    const cash = quarterly ? s?.cashflowStatementHistoryQuarterly : s?.cashflowStatementHistory;
    return {
      symbol,
      quarterly,
      incomeStatement: normalizeRows(income?.incomeStatementHistory),
      balanceSheet: normalizeRows(balance?.balanceSheetStatements),
      cashFlow: normalizeRows(cash?.cashflowStatements),
    };
  },
});

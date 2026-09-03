import { z } from "zod";
import { defineTool } from "../types.js";
import { yf, isNotFound } from "../yahoo.js";
import { toISODate } from "../format.js";

const MODULES = ["majorHoldersBreakdown", "institutionOwnership", "fundOwnership", "insiderHolders"];

function ownership(list: any[] | undefined) {
  return (list ?? []).map((o: any) => ({
    organization: o.organization ?? null,
    pctHeld: o.pctHeld ?? null,
    position: o.position ?? null,
    value: o.value ?? null,
    reportDate: toISODate(o.reportDate),
  }));
}

export const getHolders = defineTool({
  name: "get_holders",
  title: "Get holders",
  description: "Ownership breakdown: major holders, top institutions, top funds, and insiders.",
  inputSchema: { symbol: z.string().describe("Ticker symbol") },
  handler: async ({ symbol }) => {
    try {
      const s = await yf.quoteSummary(symbol, MODULES);
      return {
        symbol,
        majorBreakdown: s?.majorHoldersBreakdown ?? {},
        institutional: ownership(s?.institutionOwnership?.ownershipList),
        funds: ownership(s?.fundOwnership?.ownershipList),
        insiders: (s?.insiderHolders?.holders ?? []).map((h: any) => ({
          name: h.name ?? null,
          relation: h.relation ?? null,
          positionDirect: h.positionDirect ?? null,
          latestTransDate: toISODate(h.latestTransDate),
        })),
      };
    } catch (err) {
      if (isNotFound(err)) return { error: "symbol not found", symbol };
      throw err;
    }
  },
});

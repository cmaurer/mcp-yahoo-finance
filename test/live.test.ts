import { describe, expect, it } from "vitest";
import { TOOL_MODULES } from "../src/tools/index.js";

const run = process.env.RUN_LIVE_TESTS === "1";
const d = run ? describe : describe.skip;

function tool(name: string) {
  const m = TOOL_MODULES.find((t) => t.name === name);
  if (!m) throw new Error(`missing tool ${name}`);
  return m;
}

d("live smoke (AAPL)", () => {
  it("get_historical_data returns rows", async () => {
    const out = (await tool("get_historical_data").handler({ symbol: "AAPL", period: "5d", interval: "1d" })) as any;
    expect(out.error).toBeUndefined();
    expect(Array.isArray(out.rows)).toBe(true);
    expect(out.rows.length).toBeGreaterThan(0);
    expect(out.rows[0]).toHaveProperty("close");
  }, 20_000);

  it("get_stock_info returns a price", async () => {
    const out = (await tool("get_stock_info").handler({ symbol: "AAPL" })) as any;
    expect(out.error).toBeUndefined();
    expect(typeof out.price).toBe("number");
  }, 20_000);

  it("get_multiple_quotes returns both symbols", async () => {
    const out = (await tool("get_multiple_quotes").handler({ symbols: ["AAPL", "MSFT"] })) as any;
    expect(Object.keys(out.quotes)).toEqual(expect.arrayContaining(["AAPL", "MSFT"]));
  }, 20_000);

  it("get_dividends returns a list", async () => {
    const out = (await tool("get_dividends").handler({ symbol: "AAPL" })) as any;
    expect(Array.isArray(out.dividends)).toBe(true);
    expect(out.dividends.length).toBeGreaterThan(0);
  }, 20_000);

  it("get_financials returns statements", async () => {
    const out = (await tool("get_financials").handler({ symbol: "AAPL", quarterly: false })) as any;
    expect(Array.isArray(out.incomeStatement)).toBe(true);
  }, 20_000);

  it("get_news returns articles", async () => {
    const out = (await tool("get_news").handler({ symbol: "AAPL", count: 5 })) as any;
    expect(Array.isArray(out.articles)).toBe(true);
  }, 20_000);

  it("search_stocks finds AAPL", async () => {
    const out = (await tool("search_stocks").handler({ query: "apple", limit: 5 })) as any;
    expect(out.results.some((r: any) => r.symbol === "AAPL")).toBe(true);
  }, 20_000);

  it("get_earnings / get_recommendations / get_holders / get_options_chain / get_analyst_price_targets / get_trending_symbols / get_splits do not error", async () => {
    for (const [name, args] of [
      ["get_earnings", { symbol: "AAPL" }],
      ["get_recommendations", { symbol: "AAPL" }],
      ["get_holders", { symbol: "AAPL" }],
      ["get_options_chain", { symbol: "AAPL" }],
      ["get_analyst_price_targets", { symbol: "AAPL" }],
      ["get_trending_symbols", { region: "US", count: 5 }],
      ["get_splits", { symbol: "AAPL" }],
    ] as const) {
      const out = (await tool(name).handler(args as any)) as any;
      expect(out.error, `${name} errored: ${out.error}`).toBeUndefined();
    }
  }, 60_000);
});

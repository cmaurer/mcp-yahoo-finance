import YahooFinance from "yahoo-finance2";

const instance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const OPTS = { validateResult: false } as const;

export const yf = {
  quote: (symbols: string | string[]) => instance.quote(symbols as never, {}, OPTS),
  quoteSummary: (symbol: string, modules: string[]) =>
    instance.quoteSummary(symbol, { modules } as never, OPTS),
  chart: (
    symbol: string,
    opts: { period1: Date; period2?: Date; interval?: string; events?: string },
  ) => instance.chart(symbol, opts as never, OPTS),
  search: (query: string, opts: Record<string, unknown> = {}) =>
    instance.search(query, opts as never, OPTS),
  recommendationsBySymbol: (symbol: string) =>
    instance.recommendationsBySymbol(symbol as never, {}, OPTS),
  trendingSymbols: (region: string, opts: Record<string, unknown> = {}) =>
    instance.trendingSymbols(region as never, opts as never, OPTS),
  options: (symbol: string, opts: Record<string, unknown> = {}) =>
    instance.options(symbol, opts as never, OPTS),
};

export function isNotFound(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  if (m.includes("not found") || m.includes("no data found") || m.includes("delisted")) {
    return true;
  }
  const status = (err as { response?: { status?: number } }).response?.status;
  return status === 404;
}

export function normalizeError(err: unknown, symbol?: string): { error: string; symbol?: string } {
  const withSym = symbol ? { symbol } : {};
  if (isNotFound(err)) return { error: "symbol not found", ...withSym };
  const message = err instanceof Error ? err.message : String(err);
  return { error: message, ...withSym };
}

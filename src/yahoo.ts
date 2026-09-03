import YahooFinance from "yahoo-finance2";

// yahoo-finance2's default logger routes info/dir to stdout (console.log), which
// would corrupt the stdio JSON-RPC stream. Force every channel to stderr.
const stderrLogger = {
  info: (...a: unknown[]) => console.error(...a),
  warn: (...a: unknown[]) => console.error(...a),
  error: (...a: unknown[]) => console.error(...a),
  dir: (...a: unknown[]) => console.error(...a),
  debug: () => {},
};

const instance = new YahooFinance({ suppressNotices: ["yahooSurvey"], logger: stderrLogger });
const OPTS = { validateResult: false } as const;

// Return values are typed `any` deliberately: yahoo-finance2's own result types
// are large, and each tool narrows what it reads. This wrapper is the single
// boundary where the untyped Yahoo payloads enter the codebase.
export const yf = {
  quote: (symbols: string | string[]): Promise<any> => instance.quote(symbols as never, {}, OPTS),
  quoteSummary: (symbol: string, modules: string[]): Promise<any> =>
    instance.quoteSummary(symbol, { modules } as never, OPTS),
  chart: (
    symbol: string,
    opts: { period1: Date; period2?: Date; interval?: string; events?: string },
  ): Promise<any> => instance.chart(symbol, opts as never, OPTS),
  search: (query: string, opts: Record<string, unknown> = {}): Promise<any> =>
    instance.search(query, opts as never, OPTS),
  trendingSymbols: (region: string, opts: Record<string, unknown> = {}): Promise<any> =>
    instance.trendingSymbols(region as never, opts as never, OPTS),
  options: (symbol: string, opts: Record<string, unknown> = {}): Promise<any> =>
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

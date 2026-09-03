# MCP Yahoo Finance Server — Design

**Date:** 2026-09-02
**Status:** Approved for planning
**Owner:** Christian Maurer

## Problem

The Yahoo Finance MCP server currently in use
([`barvhaim/yfinance-mcp-server`](https://github.com/barvhaim/yfinance-mcp-server),
Python/FastMCP/`yfinance`) has a bug: its price-history tool
(`get_historical_data`) is failing. Upstream is not ours to fix on our
schedule. We want our own server we can keep updated.

## Goals

- Drop-in replacement for the current server: same tool names and
  parameter shapes so existing MCP client config keeps working.
- Feature parity with the original's 10 tools, plus a few high-value
  extras.
- A price-history tool that actually works.
- Trivial to update: push to our GitHub repo, clients pick it up on
  next launch.

## Non-goals

- Publishing to npm (may happen later; not now).
- Caching, rate-limit management, or a persistence layer.
- Auth / multi-user concerns. This is a local stdio server.
- A generic "any Yahoo endpoint" abstraction.

## Stack & distribution

| Concern | Choice |
|---|---|
| Language | TypeScript (ES2022, `"module": "nodenext"`) |
| MCP framework | `@modelcontextprotocol/sdk` |
| Transport | stdio only |
| Data layer | [`yahoo-finance2`](https://github.com/gadicc/node-yahoo-finance2) |
| Input validation | `zod` (tool input schemas, per MCP SDK convention) |
| Tests | `vitest` |
| CI | GitHub Actions: build + unit tests on push / PR |
| Node | >= 20 |

**Run / distribute via `npx` from Git:**

```jsonc
// MCP client config
{
  "mcpServers": {
    "yahoo-finance": {
      "command": "npx",
      "args": ["-y", "github:chris-p-maurer/mcp-yahoo-finance"]
    }
  }
}
```

`package.json` provides:

- `"bin": { "mcp-yahoo-finance": "dist/index.js" }` with a
  `#!/usr/bin/env node` shebang on the built entry.
- `"prepare": "npm run build"` so `npx github:...` compiles TypeScript
  on clone.
- `"files"` / `.npmignore` are not critical for the Git path but
  should be set for a possible future npm publish.

Updating the server = commit + push to `main`. Clients re-fetch on the
next `npx` invocation (npx caches by ref; document that a
`--ignore-existing` or cache clear forces immediate refresh).

## Architecture

Approach A from brainstorming: modular tools directory.

```
src/
  index.ts          # server bootstrap: create Server, register tools, connect stdio
  server.ts         # buildServer() — pure, no side effects, used by tests
  yahoo.ts          # thin wrapper around yahoo-finance2: one place for config + error normalization
  format.ts         # shared helpers: epoch->ISO, number rounding, table->rows normalization
  tools/
    index.ts        # array of all Tool definitions
    getStockInfo.ts
    getHistoricalData.ts
    getDividends.ts
    getSplits.ts
    getFinancials.ts
    getEarnings.ts
    getNews.ts
    getRecommendations.ts
    searchStocks.ts
    getMultipleQuotes.ts
    getOptionsChain.ts
    getHolders.ts
    getAnalystPriceTargets.ts
    getTrendingSymbols.ts
  types.ts          # shared TS types (ToolModule, etc.)
test/
  tools/*.test.ts    # unit tests, yahoo-finance2 mocked
  live.test.ts       # smoke tests, skipped unless RUN_LIVE_TESTS=1
```

### Tool module contract

Each file in `src/tools/` exports one object:

```ts
export interface ToolModule<TInput> {
  name: string;                    // e.g. "get_historical_data"
  title: string;                   // human label
  description: string;
  inputSchema: z.ZodType<TInput>;  // zod schema
  handler: (input: TInput) => Promise<unknown>;  // returns a plain JSON-serializable value
}
```

`server.ts` iterates the modules, registers each with the MCP SDK,
and wraps every `handler` call in the shared error boundary
(see Error handling). Handlers themselves never build MCP content
envelopes — they return data or throw.

### `yahoo.ts`

- Instantiates `yahoo-finance2` with
  `new YahooFinance({ validation: { logErrors: false } })` so schema
  chatter does not pollute stdio (stdio is the MCP channel — nothing
  except protocol messages may go to stdout; all logging goes to
  stderr).
- Exports typed helper functions used by tools, e.g. `chart()`,
  `quoteSummary()`, `search()`, `quote()`, `recommendationsBySymbol()`,
  `trendingSymbols()`, `options()`. This keeps the `yahoo-finance2`
  import in exactly one file, so an upstream API change is a one-file
  fix.
- Normalizes the library's validation failure: on a
  `FailedYahooValidationError`-style throw (exact class name to be
  confirmed during implementation), catch it, and return
  `{ data: error.result, warning: "schema drift: <n> field(s) did not validate" }`
  instead of propagating. Rationale: Yahoo changes payloads often; a
  partial answer beats a hard failure.

## Tools

### Parity tools (names + params matched to the original)

| Tool | Params | Returns |
|---|---|---|
| `get_stock_info` | `symbol: string` | Merged snapshot from `quote` + `quoteSummary` submodules `assetProfile`, `summaryDetail`, `financialData`, `defaultKeyStatistics`. Flattened object of the commonly used fields (price, market cap, PE, 52wk range, sector, employees, description, etc.). |
| `get_historical_data` | `symbol: string`, `period: enum = "1mo"`, `interval: enum = "1d"` | `{ symbol, period, interval, rows: [{ date, open, high, low, close, adjClose, volume }], meta }`. **Implemented with `chart()`**, not the deprecated `historical()`. `period` is converted to `period1`/`period2` dates (see Period handling). |
| `get_dividends` | `symbol: string` | `{ symbol, dividends: [{ date, amount }] }`. From `chart()` with `events: "dividends"` (or `quoteSummary` where cleaner). |
| `get_splits` | `symbol: string` | `{ symbol, splits: [{ date, numerator, denominator, ratio }] }`. From `chart()` with `events: "splits"`. |
| `get_financials` | `symbol: string`, `quarterly: boolean = false` | `{ symbol, quarterly, incomeStatement: [...], balanceSheet: [...], cashFlow: [...] }`. Uses `quoteSummary` submodules `incomeStatementHistory(Quarterly)`, `balanceSheetHistory(Quarterly)`, `cashflowStatementHistory(Quarterly)`. |
| `get_earnings` | `symbol: string` | `{ symbol, earningsChart, financialsChart, quarterly, yearly, nextEarningsDate }`. From `quoteSummary` submodules `earnings`, `earningsHistory`, `earningsTrend`, `calendarEvents`. |
| `get_news` | `symbol: string`, `count: number = 10` | `{ symbol, articles: [{ title, publisher, link, publishedAt, type, relatedTickers }] }`. From `search(symbol, { newsCount: count })`. |
| `get_recommendations` | `symbol: string` | `{ symbol, trend: [{ period, strongBuy, buy, hold, sell, strongSell }], note }`. From `quoteSummary` submodule `recommendationTrend`. |
| `search_stocks` | `query: string`, `limit: number = 10` | `{ query, results: [{ symbol, name, exchange, type, score }] }`. From `search(query, { quotesCount: limit, newsCount: 0 })`. |
| `get_multiple_quotes` | `symbols: string[]` | `{ quotes: { <symbol>: { price, change, changePercent, currency, marketState, ... } }, errors: { <symbol>: message } }`. From `quote(symbols)` (batch). |

Enum values:

- `period`: `1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max`
- `interval`: `1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo`

(Yahoo restricts intraday intervals to recent ranges; we pass through
and surface Yahoo's error rather than pre-validating every combination.)

### Extra tools

| Tool | Params | Returns |
|---|---|---|
| `get_options_chain` | `symbol: string`, `date?: string` (ISO; omit = nearest expiry) | `{ symbol, expirationDates, strikes, calls: [...], puts: [...] }`. From `options()`. |
| `get_holders` | `symbol: string` | `{ symbol, majorBreakdown, institutional: [...], funds: [...], insiders: [...] }`. From `quoteSummary` submodules `majorHoldersBreakdown`, `institutionOwnership`, `fundOwnership`, `insiderHolders`. |
| `get_analyst_price_targets` | `symbol: string` | `{ symbol, current, targetMean, targetHigh, targetLow, numberOfAnalysts, recommendationKey }`. From `quoteSummary` submodule `financialData`. |
| `get_trending_symbols` | `region: string = "US"`, `count: number = 10` | `{ region, quotes: [{ symbol, ... }] }`. From `trendingSymbols(region, { count })`. |

## Period handling

`yahoo-finance2`'s `chart()` takes `period1` (required) and optional
`period2` (default: now) as `Date | string | number`. Map the
original's `period` strings:

- Fixed look-backs (`1d`…`10y`): `period1 = now - offset`.
- `ytd`: `period1 = Jan 1 of current year`.
- `max`: `period1 = new Date(0)` (epoch); Yahoo clamps to the earliest
  available.

A single `periodToRange(period): { period1: Date }` helper in
`format.ts`, unit-tested.

## Error handling

One error boundary, applied by `server.ts` around every handler:

1. **Handler returns a value** → wrap as MCP content:
   `{ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] }`.
2. **Handler throws a known "not found" / bad-symbol error** →
   return `{ content: [...], isError: true }` with body
   `{ error: "symbol not found", symbol }`. Not a protocol error.
3. **Handler throws a `yahoo-finance2` validation error** → already
   normalized in `yahoo.ts` to a `{ data, warning }` value; treated as
   case 1.
4. **Anything else** → `{ content: [...], isError: true }` with
   `{ error: <message> }`. Never leak a stack trace to the client;
   full error goes to stderr.

`get_multiple_quotes` is partial-failure tolerant: per-symbol errors go
in an `errors` map, the call still succeeds.

All diagnostic logging uses `console.error` (stderr). stdout is
reserved for the MCP protocol.

## Testing

- **Unit** (`test/tools/*.test.ts`): `yahoo-finance2` mocked via
  `vi.mock`. For each tool: happy path shape, empty/missing data,
  thrown error → structured error. Plus `periodToRange` and `format.ts`
  helpers directly.
- **Server** (`test/server.test.ts`): `buildServer()` registers all
  expected tool names; unknown tool name is rejected; error boundary
  converts a throwing handler into `isError` without crashing.
- **Live smoke** (`test/live.test.ts`): real calls for `AAPL` across
  every tool, asserting only coarse shape. Guarded by
  `if (!process.env.RUN_LIVE_TESTS) test.skip`. Run manually and in a
  scheduled (non-blocking) CI job.
- **CI**: GitHub Actions workflow — `npm ci`, `npm run build`,
  `npm test` on push and PR to `main`. Node 20 and 22 matrix.

## Repo layout & tooling

- `tsconfig.json` — strict, `outDir: dist`, `nodenext`.
- `package.json` scripts: `build` (`tsc`), `dev`
  (`tsc --watch` / `node --watch dist/index.js`), `test`
  (`vitest run`), `test:live` (`RUN_LIVE_TESTS=1 vitest run live`),
  `lint` (optional: `eslint`), `format` (optional: `prettier`).
- `.gitignore` — `node_modules`, `dist`.
- `README.md` — install snippet, tool reference table, update
  instructions, troubleshooting (npx cache).
- `LICENSE` — MIT (confirm with owner).

## Open items to resolve during implementation

- Exact class name / detection for `yahoo-finance2` validation errors
  (`FailedYahooValidationError`?) and whether `{ validateResult: false }`
  per-call is simpler than catching.
- Whether `get_dividends` / `get_splits` are cleaner from `chart()`
  events or a `quoteSummary` submodule.
- Confirming `npx github:<user>/<repo>` runs `prepare` in the user's
  npm/npx version; document a fallback (clone + `npm i` + local path)
  in the README if not.

## Migration

1. Build and verify locally against the same tickers that currently
   fail.
2. Swap the MCP client config `command`/`args` to the `npx github:`
   form.
3. Keep tool names identical — no prompt or workflow changes needed
   downstream.

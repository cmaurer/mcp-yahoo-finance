# mcp-yahoo-finance

An [MCP](https://modelcontextprotocol.io) server that exposes Yahoo Finance data — quotes, historical prices, dividends, splits, financial statements, earnings, news, analyst coverage, options chains, holders, and trending symbols — to any MCP-compatible client. It is written in TypeScript, talks to Yahoo via the [`yahoo-finance2`](https://github.com/gadicc/node-yahoo-finance2) library (v4), and is designed as a drop-in replacement for [`barvhaim/yfinance-mcp-server`](https://github.com/barvhaim/yfinance-mcp-server): the ten parity tools keep the same names and parameters, so existing prompts and client configs keep working after switching the `command`.

## Requirements

- Node.js >= 22

## Install / configure

Add the server to your MCP client configuration:

```json
{
  "mcpServers": {
    "yahoo-finance": {
      "command": "npx",
      "args": ["-y", "github:USER/mcp-yahoo-finance"]
    }
  }
}
```

Replace `USER` with your GitHub username/org once the repo is pushed (so the argument reads e.g. `github:your-name/mcp-yahoo-finance`).

`npx` fetches the repository straight from GitHub. On first fetch it runs the package's `prepare` script, which invokes `npm run build` (`tsc`) to compile the TypeScript in `src/` to `dist/`. The client then launches the compiled entry point (`dist/index.js`) over stdio. No separate publish step or npm registry entry is required.

## Updating

The server is consumed directly from the Git repository, so shipping an update is just:

```bash
git push origin main
```

Clients pick up the new revision the next time they launch the server. If a client has already cached a build and you need it to refresh immediately, clear the npx cache:

```bash
npx clear-npx-cache
# or, equivalently:
rm -rf ~/.npm/_npx
```

## Local development

```bash
git clone https://github.com/USER/mcp-yahoo-finance
cd mcp-yahoo-finance
npm install
npm run build
```

Then point your MCP client at the local build instead of `npx`:

```json
{
  "mcpServers": {
    "yahoo-finance": {
      "command": "node",
      "args": ["/abs/path/to/mcp-yahoo-finance/dist/index.js"]
    }
  }
}
```

Use an absolute path to `dist/index.js`.

Scripts:

- `npm run build` — compile `src/` to `dist/` with `tsc`.
- `npm run dev` — `tsc --watch`; recompiles on save.
- `npm test` — run the unit test suite (fully mocked, no network).
- `npm run test:live` — run the gated live smoke tests, which make real requests to Yahoo Finance (sets `RUN_LIVE_TESTS=1`; skipped by `npm test`).

## Tools

All parameters are passed as a JSON object. `symbol` / `symbols` / `query` are required; every other parameter has a default and may be omitted.

### Parity tools (compatible with `barvhaim/yfinance-mcp-server`)

| Tool | Parameters (default) | Description |
|---|---|---|
| `get_stock_info` | `symbol`: string | Current price, valuation, and company profile for a ticker. |
| `get_historical_data` | `symbol`: string; `period`: `1d` \| `5d` \| `1mo` \| `3mo` \| `6mo` \| `1y` \| `2y` \| `5y` \| `10y` \| `ytd` \| `max` (default `1mo`); `interval`: `1m` \| `2m` \| `5m` \| `15m` \| `30m` \| `60m` \| `90m` \| `1h` \| `1d` \| `5d` \| `1wk` \| `1mo` \| `3mo` (default `1d`) | OHLCV history for a ticker over a period at an interval. |
| `get_dividends` | `symbol`: string | Full dividend payment history for a ticker. |
| `get_splits` | `symbol`: string | Full stock-split history for a ticker. |
| `get_financials` | `symbol`: string; `quarterly`: boolean (default `false`) | Income statement, balance sheet, and cash flow — annual or quarterly. |
| `get_earnings` | `symbol`: string | Quarterly EPS actual vs estimate, yearly revenue/earnings, and next report date. |
| `get_news` | `symbol`: string; `count`: integer 1–50 (default `10`) | Recent news articles related to a ticker. |
| `get_recommendations` | `symbol`: string | Analyst rating counts (strong buy / buy / hold / sell / strong sell) by period. |
| `search_stocks` | `query`: string; `limit`: integer 1–50 (default `10`) | Look up tickers and companies by name or symbol. |
| `get_multiple_quotes` | `symbols`: string[] (at least one) | Batch current-quote lookup for several tickers. |

### Additional tools

| Tool | Parameters (default) | Description |
|---|---|---|
| `get_options_chain` | `symbol`: string; `date`: string `YYYY-MM-DD` (optional; omit for nearest expiration) | Calls and puts for a ticker at the nearest (or a given) expiration. |
| `get_holders` | `symbol`: string | Ownership breakdown: major holders, top institutions, top funds, and insiders. |
| `get_analyst_price_targets` | `symbol`: string | Wall Street price targets and consensus rating for a ticker. |
| `get_trending_symbols` | `region`: string (default `US`), e.g. `US`, `GB`, `DE`; `count`: integer 1–50 (default `10`) | Most-active / trending tickers for a region. |

## Notes / limitations

- Data comes from Yahoo Finance's **unofficial**, undocumented endpoints via `yahoo-finance2`. Responses can change shape or rate-limit without notice; this server is best-effort and not affiliated with Yahoo.
- Intraday `interval` values (`1m`–`90m`, `1h`) only return data for **recent** date ranges. Yahoo rejects or truncates them for older `period` windows — pair them with `1d`/`5d`/`1mo`, not `5y`/`max`.
- Delisted or unknown symbols return `{ "error": "symbol not found" }` rather than throwing.
- The Yahoo statement-history feed backing `get_financials` can be sparse or entirely empty for smaller or non-US tickers; an empty `incomeStatement` / `balanceSheet` / `cashFlow` array means Yahoo returned nothing, not that the request failed.

## License

[MIT](./LICENSE) © 2026 Christian Maurer

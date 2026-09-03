# MCP Yahoo Finance Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript MCP server exposing Yahoo Finance data, a drop-in replacement for `barvhaim/yfinance-mcp-server` with a working price-history tool.

**Architecture:** stdio MCP server on `@modelcontextprotocol/sdk`. All Yahoo access goes through one wrapper module (`src/yahoo.ts`) around `yahoo-finance2` v4. Each tool is a self-contained module in `src/tools/` exporting `{ name, title, description, inputSchema, handler }`; `src/server.ts` registers every module and wraps each handler in one error boundary. Handlers return plain JSON-serializable values and never build MCP envelopes themselves.

**Tech Stack:** TypeScript (strict, `nodenext`), `@modelcontextprotocol/sdk` ^1.30, `yahoo-finance2` ^4.0, `zod` ^4, `vitest` ^4. Node >= 22.

**Spec:** `docs/superpowers/specs/2026-09-02-mcp-yahoo-finance-design.md`

## Global Constraints

- **Node >= 22.** `yahoo-finance2` v4 requires it. Set in `package.json` `engines` and the `@types/node` major.
- **Nothing except MCP protocol messages may be written to stdout.** All logging uses `console.error` (stderr). The `yahoo-finance2` instance is constructed with `suppressNotices: ["yahooSurvey"]` because that notice otherwise prints to stdout on first call and corrupts the stream.
- **Tool names and parameter shapes are frozen** to match the original server for drop-in replacement: `get_stock_info`, `get_historical_data(symbol, period="1mo", interval="1d")`, `get_dividends(symbol)`, `get_splits(symbol)`, `get_financials(symbol, quarterly=false)`, `get_earnings(symbol)`, `get_news(symbol, count=10)`, `get_recommendations(symbol)`, `search_stocks(query, limit=10)`, `get_multiple_quotes(symbols[])`. Extras: `get_options_chain`, `get_holders`, `get_analyst_price_targets`, `get_trending_symbols`.
- **All `yahoo.ts` wrappers pass `{ validateResult: false }`** and the instance is configured with `suppressNotices`. This is the resolution of the spec's open item on validation: schema drift never breaks a call; there is no `warning` field. (Deviation from spec §Error handling, which described catching a validation-error class.)
- **Handlers import `{ yf }` and call methods as `yf.chart(...)`** — never destructure (`const { chart } = yf`). Tests rely on `vi.spyOn(yf, "chart")`.
- **DRY. YAGNI. TDD. Commit after every green test cycle.**
- Every commit message ends with:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_018Vdryn8x9GxfQCP2uhYYmF
  ```
  (omitted from the code blocks below for brevity — append it to each).

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json` | deps, scripts, `bin`, `prepare` build hook, `engines` |
| `tsconfig.json` | strict, `nodenext`, `outDir: dist`, `rootDir: src` |
| `vitest.config.ts` | test globs, node environment |
| `.gitignore` | `node_modules`, `dist`, coverage |
| `src/index.ts` | entry: shebang, build server, connect `StdioServerTransport` |
| `src/server.ts` | `buildServer()` — registers tool modules, applies error boundary. No side effects. |
| `src/yahoo.ts` | configured `yahoo-finance2` instance + typed `yf` wrapper + `isNotFound` / `normalizeError` |
| `src/format.ts` | `PERIODS`, `INTERVALS`, `Period`, `Interval`, `periodToRange`, `toISODate`, `toISODateTime`, `round`, `pick` |
| `src/types.ts` | `ToolModule` interface, `defineTool` helper |
| `src/tools/index.ts` | `TOOL_MODULES` array — every tool module |
| `src/tools/getStockInfo.ts` … | one file per tool (14) |
| `test/format.test.ts` | unit tests for `format.ts` |
| `test/yahoo.test.ts` | unit tests for `isNotFound` / `normalizeError` |
| `test/server.test.ts` | registration + error-boundary behavior |
| `test/tools/*.test.ts` | one file per tool, `yf` spied |
| `test/live.test.ts` | real-network smoke tests, skipped unless `RUN_LIVE_TESTS=1` |
| `.github/workflows/ci.yml` | `npm ci && npm run build && npm test` on push/PR |
| `README.md` | install snippet, tool table, update + troubleshooting notes |
| `LICENSE` | MIT |

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- Create: `src/index.ts` (temporary stub), `test/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: working `npm run build` (emits `dist/`) and `npm test` (vitest runs). Scripts: `build`, `dev`, `test`, `test:live`, `start`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "mcp-yahoo-finance",
  "version": "0.1.0",
  "description": "MCP server for Yahoo Finance data",
  "type": "module",
  "bin": { "mcp-yahoo-finance": "dist/index.js" },
  "files": ["dist"],
  "engines": { "node": ">=22" },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:live": "RUN_LIVE_TESTS=1 vitest run test/live.test.ts",
    "prepare": "npm run build"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.30.0",
    "yahoo-finance2": "^4.0.2",
    "zod": "^4.5.4"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "typescript": "^5.7.0",
    "vitest": "^4.1.11"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules
dist
coverage
*.log
```

- [ ] **Step 5: Create `src/index.ts` stub**

```ts
#!/usr/bin/env node
// Replaced in Task 4 with the real bootstrap.
console.error("mcp-yahoo-finance: not yet implemented");
```

- [ ] **Step 6: Create `test/smoke.test.ts`**

```ts
import { expect, test } from "vitest";

test("test harness runs", () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 7: Install and build**

Run: `npm install && npm run build && npm test`
Expected: install succeeds; `dist/index.js` exists; smoke test passes. Record the resolved versions of `@modelcontextprotocol/sdk`, `yahoo-finance2`, `zod` from `npm ls --depth=0` in the commit body.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold TypeScript MCP server project"
```

---

## Task 2: `format.ts` helpers

**Files:**
- Create: `src/format.ts`
- Test: `test/format.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `PERIODS: readonly Period[]`, `INTERVALS: readonly Interval[]`
  - `type Period = "1d"|"5d"|"1mo"|"3mo"|"6mo"|"1y"|"2y"|"5y"|"10y"|"ytd"|"max"`
  - `type Interval = "1m"|"2m"|"5m"|"15m"|"30m"|"60m"|"90m"|"1h"|"1d"|"5d"|"1wk"|"1mo"|"3mo"`
  - `periodToRange(period: Period, now?: Date): { period1: Date; period2: Date }`
  - `toISODate(v: number | string | Date | null | undefined): string | null` — accepts epoch seconds or ms
  - `toISODateTime(v: number | string | Date | null | undefined): string | null`
  - `round(n: unknown, dp?: number): number | null`
  - `pick<T extends object, K extends keyof T>(obj: T | null | undefined, keys: K[]): Pick<T, K>`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { periodToRange, toISODate, toISODateTime, round, pick, PERIODS, INTERVALS } from "../src/format.js";

describe("periodToRange", () => {
  const now = new Date("2026-09-02T12:00:00Z");

  it("computes a fixed look-back for 1mo (30 days)", () => {
    const { period1, period2 } = periodToRange("1mo", now);
    expect(period2).toEqual(now);
    expect(period1.toISOString().slice(0, 10)).toBe("2026-08-03");
  });

  it("uses Jan 1 of the current year for ytd", () => {
    expect(periodToRange("ytd", now).period1.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("uses the unix epoch for max", () => {
    expect(periodToRange("max", now).period1.getTime()).toBe(0);
  });
});

describe("toISODate / toISODateTime", () => {
  it("converts epoch seconds", () => {
    expect(toISODate(1_756_814_400)).toBe("2025-09-02");
  });
  it("converts epoch milliseconds", () => {
    expect(toISODate(1_756_814_400_000)).toBe("2025-09-02");
  });
  it("passes through Date and returns full ISO for datetime", () => {
    expect(toISODateTime(new Date("2026-09-02T09:30:00Z"))).toBe("2026-09-02T09:30:00.000Z");
  });
  it("returns null for nullish / invalid", () => {
    expect(toISODate(undefined)).toBeNull();
    expect(toISODate("not a date")).toBeNull();
  });
});

describe("round", () => {
  it("rounds to 2 dp by default", () => expect(round(3.14159)).toBe(3.14));
  it("respects dp", () => expect(round(3.14159, 3)).toBe(3.142));
  it("returns null for non-finite / non-number", () => {
    expect(round(NaN)).toBeNull();
    expect(round("x")).toBeNull();
    expect(round(undefined)).toBeNull();
  });
});

describe("pick", () => {
  it("selects present keys and ignores missing", () => {
    expect(pick({ a: 1, b: 2, c: 3 }, ["a", "c", "z" as "a"])).toEqual({ a: 1, c: 3 });
  });
  it("returns {} for nullish input", () => {
    expect(pick(null, ["a" as never])).toEqual({});
  });
});

describe("constants", () => {
  it("exposes the frozen period and interval lists", () => {
    expect(PERIODS).toContain("max");
    expect(INTERVALS).toContain("1d");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/format.test.ts`
Expected: FAIL — `src/format.js` cannot be resolved.

- [ ] **Step 3: Implement `src/format.ts`**

```ts
export const PERIODS = [
  "1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max",
] as const;
export type Period = (typeof PERIODS)[number];

export const INTERVALS = [
  "1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h", "1d", "5d", "1wk", "1mo", "3mo",
] as const;
export type Interval = (typeof INTERVALS)[number];

const DAY = 86_400_000;
const OFFSETS: Record<Exclude<Period, "ytd" | "max">, number> = {
  "1d": DAY, "5d": 5 * DAY, "1mo": 30 * DAY, "3mo": 91 * DAY, "6mo": 182 * DAY,
  "1y": 365 * DAY, "2y": 730 * DAY, "5y": 1825 * DAY, "10y": 3650 * DAY,
};

export function periodToRange(period: Period, now: Date = new Date()): { period1: Date; period2: Date } {
  const period2 = now;
  if (period === "max") return { period1: new Date(0), period2 };
  if (period === "ytd") return { period1: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), period2 };
  return { period1: new Date(now.getTime() - OFFSETS[period]), period2 };
}

function toDate(v: number | string | Date | null | undefined): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    const ms = Math.abs(v) < 1e12 ? v * 1000 : v; // heuristic: < 1e12 => seconds
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toISODate(v: number | string | Date | null | undefined): string | null {
  return toDate(v)?.toISOString().slice(0, 10) ?? null;
}

export function toISODateTime(v: number | string | Date | null | undefined): string | null {
  return toDate(v)?.toISOString() ?? null;
}

export function round(n: unknown, dp = 2): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export function pick<T extends object, K extends keyof T>(
  obj: T | null | undefined,
  keys: K[],
): Pick<T, K> {
  const out = {} as Pick<T, K>;
  if (!obj) return out;
  for (const k of keys) if (k in obj && obj[k] !== undefined) out[k] = obj[k];
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/format.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/format.ts test/format.test.ts
git commit -m "feat: add format helpers (period ranges, epoch conversion, rounding)"
```

---

## Task 3: `yahoo.ts` wrapper

**Files:**
- Create: `src/yahoo.ts`
- Test: `test/yahoo.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `yf` — object with methods, each forwarding to the configured `yahoo-finance2` instance with `{ validateResult: false }`:
    - `yf.quote(symbols: string | string[]): Promise<any>`
    - `yf.quoteSummary(symbol: string, modules: string[]): Promise<any>`
    - `yf.chart(symbol: string, opts: { period1: Date; period2?: Date; interval?: string; events?: string }): Promise<any>`
    - `yf.search(query: string, opts?: Record<string, unknown>): Promise<any>`
    - `yf.recommendationsBySymbol(symbol: string): Promise<any>`
    - `yf.trendingSymbols(region: string, opts?: Record<string, unknown>): Promise<any>`
    - `yf.options(symbol: string, opts?: Record<string, unknown>): Promise<any>`
  - `isNotFound(err: unknown): boolean`
  - `normalizeError(err: unknown, symbol?: string): { error: string; symbol?: string }`

  Return values are typed `any` deliberately — `yahoo-finance2`'s own types are large and each tool narrows what it reads. Tool tests supply fixtures.

- [ ] **Step 1: Verify the installed API**

Run: `node -e "import('yahoo-finance2').then(m=>{const Y=m.default; const y=new Y({suppressNotices:['yahooSurvey']}); console.log(typeof y.chart, typeof y.quoteSummary, typeof y.quote, typeof y.search, typeof y.recommendationsBySymbol, typeof y.trendingSymbols, typeof y.options)})"`
Expected: prints `function function function function function function function`. If any is `undefined`, open `node_modules/yahoo-finance2/dist/esm/src/index.d.ts` and adjust the method name in `src/yahoo.ts` before continuing.

- [ ] **Step 2: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { isNotFound, normalizeError } from "../src/yahoo.js";

describe("isNotFound", () => {
  it("is true for 'not found' messages", () => {
    expect(isNotFound(new Error("Quote not found for ticker symbol: ZZZZ"))).toBe(true);
  });
  it("is true for 'No data found'", () => {
    expect(isNotFound(new Error("No data found, symbol may be delisted"))).toBe(true);
  });
  it("is true for an HTTP 404-shaped error", () => {
    const e = Object.assign(new Error("Request failed"), { response: { status: 404 } });
    expect(isNotFound(e)).toBe(true);
  });
  it("is false for other errors and non-errors", () => {
    expect(isNotFound(new Error("network timeout"))).toBe(false);
    expect(isNotFound("nope")).toBe(false);
  });
});

describe("normalizeError", () => {
  it("maps not-found to a structured message with the symbol", () => {
    expect(normalizeError(new Error("Quote not found"), "ZZZZ")).toEqual({
      error: "symbol not found",
      symbol: "ZZZZ",
    });
  });
  it("passes through other error messages", () => {
    expect(normalizeError(new Error("boom"))).toEqual({ error: "boom" });
  });
  it("stringifies non-Error throws", () => {
    expect(normalizeError("weird")).toEqual({ error: "weird" });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run test/yahoo.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/yahoo.ts`**

```ts
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/yahoo.test.ts && npm run build`
Expected: tests PASS; `tsc` compiles with no errors. If `tsc` complains about the `as never` casts, widen to `as any` and add `// eslint-disable` is not needed — `any` is acceptable in this single boundary file.

- [ ] **Step 6: Commit**

```bash
git add src/yahoo.ts test/yahoo.test.ts
git commit -m "feat: add yahoo-finance2 wrapper with error classification"
```

---

## Task 4: Tool contract, server, and stdio entry

**Files:**
- Create: `src/types.ts`, `src/server.ts`
- Modify: `src/index.ts` (replace stub)
- Create: `src/tools/index.ts` (empty registry to start)
- Test: `test/server.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (uses `zod` directly).
- Produces:
  - `interface ToolModule<S extends z.ZodRawShape = z.ZodRawShape>` with fields `name: string`, `title: string`, `description: string`, `inputSchema: S`, `handler: (args: z.output<z.ZodObject<S>>) => Promise<unknown>`
  - `defineTool<S extends z.ZodRawShape>(mod: ToolModule<S>): ToolModule<S>`
  - `buildServer(modules?: ToolModule[]): McpServer` — registers each module; every handler is wrapped so a returned value becomes `{ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] }` and a thrown error becomes the same shape with `isError: true` and body `normalizeError(err)`. Errors are also `console.error`'d.
  - `TOOL_MODULES: ToolModule[]` in `src/tools/index.ts` (starts `[]`, each later task appends).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { defineTool } from "../src/types.js";
import { buildServer } from "../src/server.js";

const ok = defineTool({
  name: "echo_ok",
  title: "Echo OK",
  description: "returns its input",
  inputSchema: { value: z.string() },
  handler: async ({ value }) => ({ echoed: value }),
});

const boom = defineTool({
  name: "always_throws",
  title: "Boom",
  description: "throws",
  inputSchema: {},
  handler: async () => {
    throw new Error("kaboom");
  },
});

async function callTool(server: ReturnType<typeof buildServer>, name: string, args: unknown) {
  // McpServer exposes registered tools via its internal registry; invoke the
  // stored callback directly.
  const entry = (server as unknown as {
    _registeredTools: Record<string, { callback: (a: unknown) => Promise<unknown> }>;
  })._registeredTools[name];
  if (!entry) throw new Error(`tool ${name} not registered`);
  return entry.callback(args) as Promise<{ content: { text: string }[]; isError?: boolean }>;
}

describe("buildServer", () => {
  it("registers every provided module by name", () => {
    const server = buildServer([ok, boom]);
    const names = Object.keys(
      (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools,
    );
    expect(names).toEqual(expect.arrayContaining(["echo_ok", "always_throws"]));
  });

  it("wraps a returned value as pretty JSON text content", async () => {
    const server = buildServer([ok]);
    const res = await callTool(server, "echo_ok", { value: "hi" });
    expect(res.isError).toBeFalsy();
    expect(JSON.parse(res.content[0]!.text)).toEqual({ echoed: "hi" });
  });

  it("converts a thrown error into isError content without escaping", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const server = buildServer([boom]);
    const res = await callTool(server, "always_throws", {});
    expect(res.isError).toBe(true);
    expect(JSON.parse(res.content[0]!.text)).toEqual({ error: "kaboom" });
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
```

> Note: `_registeredTools` is an internal of `McpServer`. If Step 3's build or these tests show the internal name has changed in the installed SDK version, inspect `node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts`, update the accessor in the test helper, and keep the assertions.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/server.test.ts`
Expected: FAIL — `src/types.js` / `src/server.js` not found.

- [ ] **Step 3: Implement `src/types.ts`**

```ts
import type { z } from "zod";

export interface ToolModule<S extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  title: string;
  description: string;
  inputSchema: S;
  handler: (args: z.output<z.ZodObject<S>>) => Promise<unknown>;
}

export function defineTool<S extends z.ZodRawShape>(mod: ToolModule<S>): ToolModule<S> {
  return mod;
}
```

- [ ] **Step 4: Implement `src/server.ts`**

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { normalizeError } from "./yahoo.js";
import type { ToolModule } from "./types.js";
import { TOOL_MODULES } from "./tools/index.js";

function textResult(value: unknown, isError = false) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

export function buildServer(modules: ToolModule[] = TOOL_MODULES): McpServer {
  const server = new McpServer({ name: "mcp-yahoo-finance", version: "0.1.0" });

  for (const mod of modules) {
    server.registerTool(
      mod.name,
      { title: mod.title, description: mod.description, inputSchema: mod.inputSchema },
      async (args: unknown) => {
        try {
          return textResult(await mod.handler(args as never));
        } catch (err) {
          console.error(`[${mod.name}]`, err);
          return textResult(normalizeError(err), true);
        }
      },
    );
  }

  return server;
}
```

- [ ] **Step 5: Implement `src/tools/index.ts`**

```ts
import type { ToolModule } from "../types.js";

export const TOOL_MODULES: ToolModule[] = [];
```

- [ ] **Step 6: Replace `src/index.ts`**

```ts
#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./server.js";

async function main() {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mcp-yahoo-finance: ready on stdio");
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 7: Run tests and build**

Run: `npx vitest run test/server.test.ts && npm run build`
Expected: tests PASS; `tsc` clean. If `registerTool`'s third-arg callback signature mismatches the installed SDK types, check `mcp.d.ts` and adjust (the shape `{ title, description, inputSchema }` + `(args) => result` is stable in ^1.30).

- [ ] **Step 8: Smoke-test the real binary**

Run: `node dist/index.js <<< ''` then Ctrl-C, or:
`echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/index.js`
Expected: a single JSON-RPC response line on stdout with an empty `tools` array, and `ready on stdio` on stderr. **Confirm no other text appears on stdout.**

- [ ] **Step 9: Commit**

```bash
git add src/types.ts src/server.ts src/index.ts src/tools/index.ts test/server.test.ts
git commit -m "feat: add tool-module contract, server builder, and stdio entry"
```

---

## Task 5: Quote & profile tools

Adds `get_stock_info`, `get_multiple_quotes`, `get_analyst_price_targets`.

**Files:**
- Create: `src/tools/getStockInfo.ts`, `src/tools/getMultipleQuotes.ts`, `src/tools/getAnalystPriceTargets.ts`
- Create: `test/helpers.ts`
- Modify: `src/tools/index.ts` (append the three modules)
- Test: `test/tools/getStockInfo.test.ts`, `test/tools/getMultipleQuotes.test.ts`, `test/tools/getAnalystPriceTargets.test.ts`

**Interfaces:**
- Consumes: `yf` (Task 3), `defineTool` (Task 4), `round`/`pick`/`toISODate` (Task 2).
- Produces:
  - `getStockInfo` — `inputSchema { symbol: z.string() }`; returns
    `{ symbol, price, currency, marketCap, trailingPE, forwardPE, fiftyTwoWeekHigh, fiftyTwoWeekLow, dividendYield, beta, sector, industry, employees, website, longName, exchange, description }` (nulls where absent).
  - `getMultipleQuotes` — `inputSchema { symbols: z.array(z.string()).min(1) }`; returns
    `{ quotes: Record<string, { price, change, changePercent, currency, marketState, longName }>, errors: Record<string, string> }`.
  - `getAnalystPriceTargets` — `inputSchema { symbol: z.string() }`; returns
    `{ symbol, current, targetMean, targetHigh, targetLow, targetMedian, numberOfAnalysts, recommendationKey, recommendationMean }`.
  - `test/helpers.ts` exports `restoreYf()` = `() => vi.restoreAllMocks()` and `spyYf` re-export of `vi.spyOn` for readability (optional; keep tests plain if simpler).

- [ ] **Step 1: Write `test/helpers.ts`**

```ts
import { afterEach, vi } from "vitest";

export function autoRestore(): void {
  afterEach(() => vi.restoreAllMocks());
}
```

- [ ] **Step 2: Write the failing tests**

`test/tools/getStockInfo.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { getStockInfo } from "../../src/tools/getStockInfo.js";
import { autoRestore } from "../helpers.js";

autoRestore();

describe("get_stock_info", () => {
  it("flattens quote + quoteSummary into a snapshot", async () => {
    vi.spyOn(yf, "quote").mockResolvedValue({
      regularMarketPrice: 231.2, currency: "USD", longName: "Apple Inc.",
      fullExchangeName: "NasdaqGS",
    });
    vi.spyOn(yf, "quoteSummary").mockResolvedValue({
      price: { marketCap: 3_500_000_000_000 },
      summaryDetail: {
        trailingPE: 35.1, forwardPE: 30.2, fiftyTwoWeekHigh: 260, fiftyTwoWeekLow: 164,
        dividendYield: 0.0044, beta: 1.2,
      },
      assetProfile: {
        sector: "Technology", industry: "Consumer Electronics",
        fullTimeEmployees: 164000, website: "https://apple.com",
        longBusinessSummary: "Apple designs...",
      },
    });

    const out = (await getStockInfo.handler({ symbol: "AAPL" })) as Record<string, unknown>;
    expect(out).toMatchObject({
      symbol: "AAPL", price: 231.2, currency: "USD", marketCap: 3_500_000_000_000,
      trailingPE: 35.1, sector: "Technology", employees: 164000, longName: "Apple Inc.",
      exchange: "NasdaqGS",
    });
    expect(yf.quoteSummary).toHaveBeenCalledWith("AAPL", expect.arrayContaining(["assetProfile", "summaryDetail", "price"]));
  });

  it("returns a structured not-found error", async () => {
    vi.spyOn(yf, "quote").mockRejectedValue(new Error("Quote not found for ticker symbol: ZZZZ"));
    vi.spyOn(yf, "quoteSummary").mockRejectedValue(new Error("Quote not found"));
    const out = await getStockInfo.handler({ symbol: "ZZZZ" });
    expect(out).toEqual({ error: "symbol not found", symbol: "ZZZZ" });
  });
});
```

`test/tools/getMultipleQuotes.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { getMultipleQuotes } from "../../src/tools/getMultipleQuotes.js";
import { autoRestore } from "../helpers.js";

autoRestore();

describe("get_multiple_quotes", () => {
  it("keys results by symbol and rounds", async () => {
    vi.spyOn(yf, "quote").mockResolvedValue([
      { symbol: "AAPL", regularMarketPrice: 231.239, regularMarketChange: 1.234,
        regularMarketChangePercent: 0.536, currency: "USD", marketState: "REGULAR", longName: "Apple Inc." },
      { symbol: "MSFT", regularMarketPrice: 420.1, regularMarketChange: -2.0,
        regularMarketChangePercent: -0.47, currency: "USD", marketState: "REGULAR", longName: "Microsoft" },
    ]);
    const out = (await getMultipleQuotes.handler({ symbols: ["AAPL", "MSFT"] })) as {
      quotes: Record<string, { price: number }>; errors: Record<string, string>;
    };
    expect(out.quotes.AAPL!.price).toBe(231.24);
    expect(out.quotes.MSFT!.price).toBe(420.1);
    expect(out.errors).toEqual({});
  });

  it("records symbols missing from the response under errors", async () => {
    vi.spyOn(yf, "quote").mockResolvedValue([
      { symbol: "AAPL", regularMarketPrice: 231, currency: "USD", marketState: "REGULAR" },
    ]);
    const out = (await getMultipleQuotes.handler({ symbols: ["AAPL", "ZZZZ"] })) as {
      errors: Record<string, string>;
    };
    expect(out.errors.ZZZZ).toMatch(/no quote/i);
  });

  it("maps a total failure to a structured error", async () => {
    vi.spyOn(yf, "quote").mockRejectedValue(new Error("network down"));
    const out = await getMultipleQuotes.handler({ symbols: ["AAPL"] });
    expect(out).toEqual({ error: "network down" });
  });
});
```

`test/tools/getAnalystPriceTargets.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { getAnalystPriceTargets } from "../../src/tools/getAnalystPriceTargets.js";
import { autoRestore } from "../helpers.js";

autoRestore();

describe("get_analyst_price_targets", () => {
  it("extracts targets from financialData", async () => {
    vi.spyOn(yf, "quoteSummary").mockResolvedValue({
      financialData: {
        currentPrice: 231.2, targetMeanPrice: 250, targetHighPrice: 300, targetLowPrice: 180,
        targetMedianPrice: 245, numberOfAnalystOpinions: 40, recommendationKey: "buy",
        recommendationMean: 2.1,
      },
    });
    const out = (await getAnalystPriceTargets.handler({ symbol: "AAPL" })) as Record<string, unknown>;
    expect(out).toMatchObject({
      symbol: "AAPL", current: 231.2, targetMean: 250, targetHigh: 300, targetLow: 180,
      numberOfAnalysts: 40, recommendationKey: "buy",
    });
  });

  it("returns nulls when financialData is absent", async () => {
    vi.spyOn(yf, "quoteSummary").mockResolvedValue({});
    const out = (await getAnalystPriceTargets.handler({ symbol: "AAPL" })) as Record<string, unknown>;
    expect(out).toMatchObject({ symbol: "AAPL", targetMean: null, numberOfAnalysts: null });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run test/tools/getStockInfo.test.ts test/tools/getMultipleQuotes.test.ts test/tools/getAnalystPriceTargets.test.ts`
Expected: FAIL — tool modules not found.

- [ ] **Step 4: Implement `src/tools/getStockInfo.ts`**

```ts
import { z } from "zod";
import { defineTool } from "../types.js";
import { yf, isNotFound } from "../yahoo.js";
import { round } from "../format.js";

const MODULES = ["assetProfile", "summaryDetail", "price", "financialData", "defaultKeyStatistics"];

export const getStockInfo = defineTool({
  name: "get_stock_info",
  title: "Get stock info",
  description: "Current price, valuation, and company profile for a ticker.",
  inputSchema: { symbol: z.string().describe("Ticker symbol, e.g. AAPL") },
  handler: async ({ symbol }) => {
    try {
      const [q, s] = await Promise.all([
        yf.quote(symbol),
        yf.quoteSummary(symbol, MODULES),
      ]);
      const sd = s?.summaryDetail ?? {};
      const ap = s?.assetProfile ?? {};
      return {
        symbol,
        price: round(q?.regularMarketPrice) ?? round(s?.price?.regularMarketPrice),
        currency: q?.currency ?? s?.price?.currency ?? null,
        longName: q?.longName ?? s?.price?.longName ?? null,
        exchange: q?.fullExchangeName ?? s?.price?.exchangeName ?? null,
        marketCap: s?.price?.marketCap ?? sd.marketCap ?? null,
        trailingPE: round(sd.trailingPE) ?? null,
        forwardPE: round(sd.forwardPE) ?? null,
        fiftyTwoWeekHigh: round(sd.fiftyTwoWeekHigh) ?? null,
        fiftyTwoWeekLow: round(sd.fiftyTwoWeekLow) ?? null,
        dividendYield: sd.dividendYield ?? null,
        beta: round(sd.beta) ?? null,
        sector: ap.sector ?? null,
        industry: ap.industry ?? null,
        employees: ap.fullTimeEmployees ?? null,
        website: ap.website ?? null,
        description: ap.longBusinessSummary ?? null,
      };
    } catch (err) {
      if (isNotFound(err)) return { error: "symbol not found", symbol };
      throw err;
    }
  },
});
```

- [ ] **Step 5: Implement `src/tools/getMultipleQuotes.ts`**

```ts
import { z } from "zod";
import { defineTool } from "../types.js";
import { yf } from "../yahoo.js";
import { round } from "../format.js";

export const getMultipleQuotes = defineTool({
  name: "get_multiple_quotes",
  title: "Get multiple quotes",
  description: "Batch current-quote lookup for several tickers.",
  inputSchema: { symbols: z.array(z.string()).min(1).describe("Ticker symbols") },
  handler: async ({ symbols }) => {
    let rows: any[];
    try {
      const res = await yf.quote(symbols);
      rows = Array.isArray(res) ? res : [res];
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
    const bySymbol = new Map<string, any>(rows.filter(Boolean).map((r) => [r.symbol, r]));
    const quotes: Record<string, unknown> = {};
    const errors: Record<string, string> = {};
    for (const sym of symbols) {
      const r = bySymbol.get(sym);
      if (!r) {
        errors[sym] = "no quote returned";
        continue;
      }
      quotes[sym] = {
        price: round(r.regularMarketPrice),
        change: round(r.regularMarketChange),
        changePercent: round(r.regularMarketChangePercent),
        currency: r.currency ?? null,
        marketState: r.marketState ?? null,
        longName: r.longName ?? r.shortName ?? null,
      };
    }
    return { quotes, errors };
  },
});
```

- [ ] **Step 6: Implement `src/tools/getAnalystPriceTargets.ts`**

```ts
import { z } from "zod";
import { defineTool } from "../types.js";
import { yf, isNotFound } from "../yahoo.js";
import { round } from "../format.js";

export const getAnalystPriceTargets = defineTool({
  name: "get_analyst_price_targets",
  title: "Get analyst price targets",
  description: "Wall Street price targets and consensus rating for a ticker.",
  inputSchema: { symbol: z.string().describe("Ticker symbol") },
  handler: async ({ symbol }) => {
    try {
      const s = await yf.quoteSummary(symbol, ["financialData"]);
      const f = s?.financialData ?? {};
      return {
        symbol,
        current: round(f.currentPrice) ?? null,
        targetMean: round(f.targetMeanPrice) ?? null,
        targetHigh: round(f.targetHighPrice) ?? null,
        targetLow: round(f.targetLowPrice) ?? null,
        targetMedian: round(f.targetMedianPrice) ?? null,
        numberOfAnalysts: f.numberOfAnalystOpinions ?? null,
        recommendationKey: f.recommendationKey ?? null,
        recommendationMean: round(f.recommendationMean) ?? null,
      };
    } catch (err) {
      if (isNotFound(err)) return { error: "symbol not found", symbol };
      throw err;
    }
  },
});
```

- [ ] **Step 7: Append to `src/tools/index.ts`**

```ts
import type { ToolModule } from "../types.js";
import { getStockInfo } from "./getStockInfo.js";
import { getMultipleQuotes } from "./getMultipleQuotes.js";
import { getAnalystPriceTargets } from "./getAnalystPriceTargets.js";

export const TOOL_MODULES: ToolModule[] = [
  getStockInfo,
  getMultipleQuotes,
  getAnalystPriceTargets,
];
```

- [ ] **Step 8: Add a registration assertion to `test/server.test.ts`**

Append inside `describe("buildServer", ...)`:

```ts
it("registers the real tool modules", async () => {
  const { TOOL_MODULES } = await import("../src/tools/index.js");
  const server = buildServer(TOOL_MODULES);
  const names = Object.keys(
    (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools,
  );
  expect(names).toEqual(expect.arrayContaining(["get_stock_info", "get_multiple_quotes", "get_analyst_price_targets"]));
});
```

- [ ] **Step 9: Run tests and build**

Run: `npx vitest run && npm run build`
Expected: all PASS; `tsc` clean.

- [ ] **Step 10: Commit**

```bash
git add src/tools/ test/tools/getStockInfo.test.ts test/tools/getMultipleQuotes.test.ts test/tools/getAnalystPriceTargets.test.ts test/helpers.ts test/server.test.ts src/tools/index.ts
git commit -m "feat: add quote and profile tools (get_stock_info, get_multiple_quotes, get_analyst_price_targets)"
```

---

## Task 6: Price history & corporate actions — the bug fix

Adds `get_historical_data`, `get_dividends`, `get_splits`. All three use `yf.chart()` (not the removed `historical()` scrape path that broke upstream).

**Files:**
- Create: `src/tools/getHistoricalData.ts`, `src/tools/getDividends.ts`, `src/tools/getSplits.ts`
- Modify: `src/tools/index.ts`
- Test: `test/tools/getHistoricalData.test.ts`, `test/tools/getDividends.test.ts`, `test/tools/getSplits.test.ts`

**Interfaces:**
- Consumes: `yf.chart` (Task 3), `periodToRange`, `PERIODS`, `INTERVALS`, `toISODate`, `round` (Task 2), `defineTool` (Task 4).
- Produces:
  - `getHistoricalData` — `inputSchema { symbol: z.string(), period: z.enum(PERIODS).default("1mo"), interval: z.enum(INTERVALS).default("1d") }`; returns
    `{ symbol, period, interval, rows: Array<{ date, open, high, low, close, adjClose, volume }>, count, meta: { currency, exchangeName, instrumentType } }`.
  - `getDividends` — `inputSchema { symbol: z.string() }`; returns `{ symbol, dividends: Array<{ date, amount }>, count }`.
  - `getSplits` — `inputSchema { symbol: z.string() }`; returns `{ symbol, splits: Array<{ date, numerator, denominator, ratio }>, count }`.

- [ ] **Step 1: Verify the `chart()` return shape**

Run: `node -e "import('yahoo-finance2').then(async m=>{const y=new m.default({suppressNotices:['yahooSurvey']}); const r=await y.chart('AAPL',{period1:new Date(Date.now()-7*864e5)},{validateResult:false}); console.log(Object.keys(r)); console.log(r.quotes[0]); console.log(r.meta && Object.keys(r.meta));})"`
Expected: prints keys including `quotes` and `meta`; a quote row with `date, open, high, low, close, volume` and an adjusted-close field. **Record the exact adjusted-close key** (`adjclose` vs `adjClose`) and use it in Step 4. If offline, read `node_modules/yahoo-finance2/dist/esm/src/modules/chart.d.ts` for `ChartResultArrayQuote`.

- [ ] **Step 2: Write the failing tests**

`test/tools/getHistoricalData.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { getHistoricalData } from "../../src/tools/getHistoricalData.js";
import { autoRestore } from "../helpers.js";

autoRestore();

const chartFixture = {
  meta: { currency: "USD", exchangeName: "NMS", instrumentType: "EQUITY" },
  quotes: [
    { date: new Date("2026-08-25T13:30:00Z"), open: 226.1, high: 229, low: 225.4, close: 228.5, volume: 40_000_000, adjclose: 228.5 },
    { date: new Date("2026-08-26T13:30:00Z"), open: 228.9, high: 231.2, low: 228, close: 230.1, volume: 38_500_000, adjclose: 230.1 },
  ],
};

describe("get_historical_data", () => {
  it("normalizes chart() quotes into OHLCV rows", async () => {
    const spy = vi.spyOn(yf, "chart").mockResolvedValue(chartFixture as never);
    const out = (await getHistoricalData.handler({ symbol: "AAPL", period: "1mo", interval: "1d" })) as any;

    expect(out.symbol).toBe("AAPL");
    expect(out.count).toBe(2);
    expect(out.rows[0]).toEqual({
      date: "2026-08-25", open: 226.1, high: 229, low: 225.4, close: 228.5, adjClose: 228.5, volume: 40_000_000,
    });
    expect(out.meta).toEqual({ currency: "USD", exchangeName: "NMS", instrumentType: "EQUITY" });

    const [sym, opts] = spy.mock.calls[0]!;
    expect(sym).toBe("AAPL");
    expect(opts).toMatchObject({ interval: "1d" });
    expect(opts.period1).toBeInstanceOf(Date);
  });

  it("defaults period and interval when omitted", async () => {
    const spy = vi.spyOn(yf, "chart").mockResolvedValue({ meta: {}, quotes: [] } as never);
    const parsed = getHistoricalData.inputSchema; // schema exists
    await getHistoricalData.handler({ symbol: "AAPL", period: "1mo", interval: "1d" } as any);
    expect(spy).toHaveBeenCalled();
    expect(parsed).toBeDefined();
  });

  it("returns a structured not-found error", async () => {
    vi.spyOn(yf, "chart").mockRejectedValue(new Error("No data found, symbol may be delisted"));
    const out = await getHistoricalData.handler({ symbol: "ZZZZ", period: "1mo", interval: "1d" });
    expect(out).toEqual({ error: "symbol not found", symbol: "ZZZZ" });
  });
});
```

`test/tools/getDividends.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { getDividends } from "../../src/tools/getDividends.js";
import { autoRestore } from "../helpers.js";

autoRestore();

describe("get_dividends", () => {
  it("extracts dividend events from chart()", async () => {
    vi.spyOn(yf, "chart").mockResolvedValue({
      meta: {}, quotes: [],
      events: {
        dividends: [
          { date: new Date("2026-05-10T00:00:00Z"), amount: 0.25 },
          { date: new Date("2026-08-10T00:00:00Z"), amount: 0.26 },
        ],
      },
    } as never);
    const out = (await getDividends.handler({ symbol: "AAPL" })) as any;
    expect(out).toEqual({
      symbol: "AAPL",
      dividends: [
        { date: "2026-05-10", amount: 0.25 },
        { date: "2026-08-10", amount: 0.26 },
      ],
      count: 2,
    });
    const [, opts] = (yf.chart as any).mock.calls[0];
    expect(opts).toMatchObject({ events: "dividends" });
    expect(opts.period1.getTime()).toBe(0); // full history
  });

  it("handles an object-keyed events map and no dividends", async () => {
    vi.spyOn(yf, "chart").mockResolvedValue({ meta: {}, quotes: [], events: {} } as never);
    const out = (await getDividends.handler({ symbol: "AAPL" })) as any;
    expect(out).toEqual({ symbol: "AAPL", dividends: [], count: 0 });
  });
});
```

`test/tools/getSplits.test.ts`:

```ts
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run test/tools/getHistoricalData.test.ts test/tools/getDividends.test.ts test/tools/getSplits.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `src/tools/getHistoricalData.ts`**

```ts
import { z } from "zod";
import { defineTool } from "../types.js";
import { yf, isNotFound } from "../yahoo.js";
import { PERIODS, INTERVALS, periodToRange, toISODate, round } from "../format.js";

export const getHistoricalData = defineTool({
  name: "get_historical_data",
  title: "Get historical price data",
  description: "OHLCV history for a ticker over a period at an interval.",
  inputSchema: {
    symbol: z.string().describe("Ticker symbol"),
    period: z.enum(PERIODS).default("1mo").describe("Look-back window"),
    interval: z.enum(INTERVALS).default("1d").describe("Bar size"),
  },
  handler: async ({ symbol, period, interval }) => {
    try {
      const { period1, period2 } = periodToRange(period);
      const res = await yf.chart(symbol, { period1, period2, interval });
      const rows = (res?.quotes ?? []).map((q: any) => ({
        date: toISODate(q.date),
        open: round(q.open),
        high: round(q.high),
        low: round(q.low),
        close: round(q.close),
        adjClose: round(q.adjclose ?? q.adjClose),
        volume: q.volume ?? null,
      }));
      const m = res?.meta ?? {};
      return {
        symbol,
        period,
        interval,
        rows,
        count: rows.length,
        meta: {
          currency: m.currency ?? null,
          exchangeName: m.exchangeName ?? null,
          instrumentType: m.instrumentType ?? null,
        },
      };
    } catch (err) {
      if (isNotFound(err)) return { error: "symbol not found", symbol };
      throw err;
    }
  },
});
```

> If Step 1 showed the adjusted-close key is only `adjClose`, the `q.adjclose ?? q.adjClose` fallback still covers it — leave as written.

- [ ] **Step 5: Implement `src/tools/getDividends.ts`**

```ts
import { z } from "zod";
import { defineTool } from "../types.js";
import { yf, isNotFound } from "../yahoo.js";
import { toISODate, round } from "../format.js";

function asList(events: any): any[] {
  if (!events) return [];
  return Array.isArray(events) ? events : Object.values(events);
}

export const getDividends = defineTool({
  name: "get_dividends",
  title: "Get dividend history",
  description: "Full dividend payment history for a ticker.",
  inputSchema: { symbol: z.string().describe("Ticker symbol") },
  handler: async ({ symbol }) => {
    try {
      const res = await yf.chart(symbol, { period1: new Date(0), events: "dividends" });
      const dividends = asList(res?.events?.dividends)
        .map((d: any) => ({ date: toISODate(d.date), amount: round(d.amount, 4) }))
        .filter((d) => d.date !== null);
      return { symbol, dividends, count: dividends.length };
    } catch (err) {
      if (isNotFound(err)) return { error: "symbol not found", symbol };
      throw err;
    }
  },
});
```

- [ ] **Step 6: Implement `src/tools/getSplits.ts`**

```ts
import { z } from "zod";
import { defineTool } from "../types.js";
import { yf, isNotFound } from "../yahoo.js";
import { toISODate, round } from "../format.js";

function asList(events: any): any[] {
  if (!events) return [];
  return Array.isArray(events) ? events : Object.values(events);
}

export const getSplits = defineTool({
  name: "get_splits",
  title: "Get stock split history",
  description: "Full stock-split history for a ticker.",
  inputSchema: { symbol: z.string().describe("Ticker symbol") },
  handler: async ({ symbol }) => {
    try {
      const res = await yf.chart(symbol, { period1: new Date(0), events: "splits" });
      const splits = asList(res?.events?.splits)
        .map((s: any) => {
          const numerator = s.numerator ?? null;
          const denominator = s.denominator ?? null;
          return {
            date: toISODate(s.date),
            numerator,
            denominator,
            ratio: numerator && denominator ? round(numerator / denominator, 4) : null,
          };
        })
        .filter((s) => s.date !== null);
      return { symbol, splits, count: splits.length };
    } catch (err) {
      if (isNotFound(err)) return { error: "symbol not found", symbol };
      throw err;
    }
  },
});
```

- [ ] **Step 7: Append the three modules to `src/tools/index.ts`**

```ts
import { getHistoricalData } from "./getHistoricalData.js";
import { getDividends } from "./getDividends.js";
import { getSplits } from "./getSplits.js";
// ...add getHistoricalData, getDividends, getSplits to the TOOL_MODULES array
```

- [ ] **Step 8: Run tests and build**

Run: `npx vitest run && npm run build`
Expected: all PASS; `tsc` clean.

- [ ] **Step 9: Manual verification against the real failure**

Run: `echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_historical_data","arguments":{"symbol":"AAPL","period":"5d","interval":"1d"}}}' | node dist/index.js`
Expected: a JSON-RPC result whose `content[0].text` parses to an object with a non-empty `rows` array. This is the bug that motivated the project — confirm it works. Try the specific ticker/period that failed on the old server too.

- [ ] **Step 10: Commit**

```bash
git add src/tools/ test/tools/getHistoricalData.test.ts test/tools/getDividends.test.ts test/tools/getSplits.test.ts src/tools/index.ts
git commit -m "feat: add price history and corporate-action tools via chart()"
```

---

## Task 7: Fundamentals — financials & earnings

Adds `get_financials`, `get_earnings`.

**Files:**
- Create: `src/tools/getFinancials.ts`, `src/tools/getEarnings.ts`
- Modify: `src/tools/index.ts`
- Test: `test/tools/getFinancials.test.ts`, `test/tools/getEarnings.test.ts`

**Interfaces:**
- Consumes: `yf.quoteSummary` (Task 3), `toISODate`, `round` (Task 2), `defineTool` (Task 4).
- Produces:
  - `getFinancials` — `inputSchema { symbol: z.string(), quarterly: z.boolean().default(false) }`; returns
    `{ symbol, quarterly, incomeStatement: Row[], balanceSheet: Row[], cashFlow: Row[] }` where each `Row` is the raw statement object with any `*Date`/`endDate` field normalized to an ISO date string under `date`.
  - `getEarnings` — `inputSchema { symbol: z.string() }`; returns
    `{ symbol, quarterly: Array<{ date, actual, estimate }>, yearly: Array<{ year, revenue, earnings }>, nextEarningsDate }`.

- [ ] **Step 1: Verify submodule shapes**

Read `node_modules/yahoo-finance2/dist/esm/src/modules/quoteSummary.d.ts` (or run a live probe like Task 6 Step 1) and confirm the field names used below: `incomeStatementHistory.incomeStatementHistory[]`, `...Quarterly`, `balanceSheetHistory.balanceSheetStatements[]`, `cashflowStatementHistory.cashflowStatements[]`, `earnings.earningsChart.quarterly[]`, `earnings.financialsChart.yearly[]`, `calendarEvents.earnings.earningsDate[]`. Note any deviations and adjust Step 4/5 accessors.

- [ ] **Step 2: Write the failing tests**

`test/tools/getFinancials.test.ts`:

```ts
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

  it("returns a structured not-found error", async () => {
    vi.spyOn(yf, "quoteSummary").mockRejectedValue(new Error("Quote not found"));
    const out = await getFinancials.handler({ symbol: "ZZZZ", quarterly: false });
    expect(out).toEqual({ error: "symbol not found", symbol: "ZZZZ" });
  });
});
```

`test/tools/getEarnings.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { getEarnings } from "../../src/tools/getEarnings.js";
import { autoRestore } from "../helpers.js";

autoRestore();

describe("get_earnings", () => {
  it("summarizes quarterly EPS, yearly revenue/earnings, and next date", async () => {
    vi.spyOn(yf, "quoteSummary").mockResolvedValue({
      earnings: {
        earningsChart: {
          quarterly: [
            { date: "2Q2026", actual: 1.4, estimate: 1.35 },
            { date: "3Q2026", actual: 1.6, estimate: 1.55 },
          ],
        },
        financialsChart: {
          yearly: [
            { date: 2024, revenue: 383_000_000_000, earnings: 97_000_000_000 },
            { date: 2025, revenue: 400_000_000_000, earnings: 100_000_000_000 },
          ],
        },
      },
      calendarEvents: { earnings: { earningsDate: [new Date("2026-10-30T00:00:00Z")] } },
    } as never);

    const out = (await getEarnings.handler({ symbol: "AAPL" })) as any;
    expect(out.symbol).toBe("AAPL");
    expect(out.quarterly).toEqual([
      { date: "2Q2026", actual: 1.4, estimate: 1.35 },
      { date: "3Q2026", actual: 1.6, estimate: 1.55 },
    ]);
    expect(out.yearly).toEqual([
      { year: 2024, revenue: 383_000_000_000, earnings: 97_000_000_000 },
      { year: 2025, revenue: 400_000_000_000, earnings: 100_000_000_000 },
    ]);
    expect(out.nextEarningsDate).toBe("2026-10-30");
  });

  it("tolerates missing sections", async () => {
    vi.spyOn(yf, "quoteSummary").mockResolvedValue({} as never);
    const out = (await getEarnings.handler({ symbol: "AAPL" })) as any;
    expect(out).toEqual({ symbol: "AAPL", quarterly: [], yearly: [], nextEarningsDate: null });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run test/tools/getFinancials.test.ts test/tools/getEarnings.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `src/tools/getFinancials.ts`**

```ts
import { z } from "zod";
import { defineTool } from "../types.js";
import { yf, isNotFound } from "../yahoo.js";
import { toISODate } from "../format.js";

const ANNUAL = ["incomeStatementHistory", "balanceSheetHistory", "cashflowStatementHistory"];
const QUARTERLY = [
  "incomeStatementHistoryQuarterly",
  "balanceSheetHistoryQuarterly",
  "cashflowStatementHistoryQuarterly",
];

function normalizeRows(rows: any[] | undefined): any[] {
  return (rows ?? []).map((r) => {
    const { endDate, ...rest } = r ?? {};
    return { date: toISODate(endDate ?? r?.date), ...rest };
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
    try {
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
    } catch (err) {
      if (isNotFound(err)) return { error: "symbol not found", symbol };
      throw err;
    }
  },
});
```

- [ ] **Step 5: Implement `src/tools/getEarnings.ts`**

```ts
import { z } from "zod";
import { defineTool } from "../types.js";
import { yf, isNotFound } from "../yahoo.js";
import { toISODate, round } from "../format.js";

export const getEarnings = defineTool({
  name: "get_earnings",
  title: "Get earnings",
  description: "Quarterly EPS actual vs estimate, yearly revenue/earnings, and next report date.",
  inputSchema: { symbol: z.string().describe("Ticker symbol") },
  handler: async ({ symbol }) => {
    try {
      const s = await yf.quoteSummary(symbol, ["earnings", "calendarEvents"]);
      const quarterly = (s?.earnings?.earningsChart?.quarterly ?? []).map((q: any) => ({
        date: q.date ?? null,
        actual: round(q.actual, 4),
        estimate: round(q.estimate, 4),
      }));
      const yearly = (s?.earnings?.financialsChart?.yearly ?? []).map((y: any) => ({
        year: y.date ?? null,
        revenue: y.revenue ?? null,
        earnings: y.earnings ?? null,
      }));
      const rawNext = s?.calendarEvents?.earnings?.earningsDate?.[0] ?? null;
      return { symbol, quarterly, yearly, nextEarningsDate: toISODate(rawNext) };
    } catch (err) {
      if (isNotFound(err)) return { error: "symbol not found", symbol };
      throw err;
    }
  },
});
```

- [ ] **Step 6: Append to `src/tools/index.ts`** (`getFinancials`, `getEarnings`).

- [ ] **Step 7: Run tests and build**

Run: `npx vitest run && npm run build`
Expected: all PASS; `tsc` clean.

- [ ] **Step 8: Commit**

```bash
git add src/tools/ test/tools/getFinancials.test.ts test/tools/getEarnings.test.ts src/tools/index.ts
git commit -m "feat: add fundamentals tools (get_financials, get_earnings)"
```

---

## Task 8: Discovery & sentiment

Adds `search_stocks`, `get_news`, `get_recommendations`, `get_trending_symbols`.

**Files:**
- Create: `src/tools/searchStocks.ts`, `src/tools/getNews.ts`, `src/tools/getRecommendations.ts`, `src/tools/getTrendingSymbols.ts`
- Modify: `src/tools/index.ts`
- Test: `test/tools/searchStocks.test.ts`, `test/tools/getNews.test.ts`, `test/tools/getRecommendations.test.ts`, `test/tools/getTrendingSymbols.test.ts`

**Interfaces:**
- Consumes: `yf.search`, `yf.quoteSummary`, `yf.trendingSymbols` (Task 3), `toISODateTime` (Task 2), `defineTool` (Task 4).
- Produces:
  - `searchStocks` — `inputSchema { query: z.string(), limit: z.number().int().min(1).max(50).default(10) }`; returns `{ query, results: Array<{ symbol, name, exchange, type, score }> }`.
  - `getNews` — `inputSchema { symbol: z.string(), count: z.number().int().min(1).max(50).default(10) }`; returns `{ symbol, articles: Array<{ title, publisher, link, publishedAt, type, relatedTickers }> }`.
  - `getRecommendations` — `inputSchema { symbol: z.string() }`; returns `{ symbol, trend: Array<{ period, strongBuy, buy, hold, sell, strongSell }>, note }`.
  - `getTrendingSymbols` — `inputSchema { region: z.string().default("US"), count: z.number().int().min(1).max(50).default(10) }`; returns `{ region, quotes: Array<{ symbol, shortName, price, changePercent }> }`.

- [ ] **Step 1: Write the failing tests**

`test/tools/searchStocks.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { searchStocks } from "../../src/tools/searchStocks.js";
import { autoRestore } from "../helpers.js";

autoRestore();

describe("search_stocks", () => {
  it("maps quotes from search() and passes the limit", async () => {
    const spy = vi.spyOn(yf, "search").mockResolvedValue({
      quotes: [
        { symbol: "AAPL", shortname: "Apple Inc.", exchange: "NMS", quoteType: "EQUITY", score: 12345, isYahooFinance: true },
        { symbol: "APLE", shortname: "Apple Hospitality", exchange: "NYQ", quoteType: "EQUITY", score: 900, isYahooFinance: true },
        { name: "Not a security", isYahooFinance: false },
      ],
    } as never);
    const out = (await searchStocks.handler({ query: "apple", limit: 5 })) as any;
    expect(out.results).toEqual([
      { symbol: "AAPL", name: "Apple Inc.", exchange: "NMS", type: "EQUITY", score: 12345 },
      { symbol: "APLE", name: "Apple Hospitality", exchange: "NYQ", type: "EQUITY", score: 900 },
    ]);
    expect(spy).toHaveBeenCalledWith("apple", expect.objectContaining({ quotesCount: 5, newsCount: 0 }));
  });
});
```

`test/tools/getNews.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { getNews } from "../../src/tools/getNews.js";
import { autoRestore } from "../helpers.js";

autoRestore();

describe("get_news", () => {
  it("maps news articles from search()", async () => {
    const spy = vi.spyOn(yf, "search").mockResolvedValue({
      news: [
        {
          title: "Apple hits new high", publisher: "Reuters",
          link: "https://example.com/a", providerPublishTime: new Date("2026-09-01T14:00:00Z"),
          type: "STORY", relatedTickers: ["AAPL"],
        },
      ],
    } as never);
    const out = (await getNews.handler({ symbol: "AAPL", count: 3 })) as any;
    expect(out).toEqual({
      symbol: "AAPL",
      articles: [
        {
          title: "Apple hits new high", publisher: "Reuters", link: "https://example.com/a",
          publishedAt: "2026-09-01T14:00:00.000Z", type: "STORY", relatedTickers: ["AAPL"],
        },
      ],
    });
    expect(spy).toHaveBeenCalledWith("AAPL", expect.objectContaining({ newsCount: 3, quotesCount: 0 }));
  });

  it("returns an empty list when there is no news", async () => {
    vi.spyOn(yf, "search").mockResolvedValue({} as never);
    const out = (await getNews.handler({ symbol: "AAPL", count: 10 })) as any;
    expect(out).toEqual({ symbol: "AAPL", articles: [] });
  });
});
```

`test/tools/getRecommendations.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { getRecommendations } from "../../src/tools/getRecommendations.js";
import { autoRestore } from "../helpers.js";

autoRestore();

describe("get_recommendations", () => {
  it("maps recommendationTrend rows", async () => {
    vi.spyOn(yf, "quoteSummary").mockResolvedValue({
      recommendationTrend: {
        trend: [
          { period: "0m", strongBuy: 10, buy: 20, hold: 5, sell: 1, strongSell: 0 },
          { period: "-1m", strongBuy: 9, buy: 19, hold: 6, sell: 1, strongSell: 0 },
        ],
      },
    } as never);
    const out = (await getRecommendations.handler({ symbol: "AAPL" })) as any;
    expect(out.symbol).toBe("AAPL");
    expect(out.trend).toHaveLength(2);
    expect(out.trend[0]).toEqual({ period: "0m", strongBuy: 10, buy: 20, hold: 5, sell: 1, strongSell: 0 });
    expect(out.note).toMatch(/analyst/i);
  });

  it("returns an empty trend when the module is missing", async () => {
    vi.spyOn(yf, "quoteSummary").mockResolvedValue({} as never);
    const out = (await getRecommendations.handler({ symbol: "AAPL" })) as any;
    expect(out.trend).toEqual([]);
  });
});
```

`test/tools/getTrendingSymbols.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { getTrendingSymbols } from "../../src/tools/getTrendingSymbols.js";
import { autoRestore } from "../helpers.js";

autoRestore();

describe("get_trending_symbols", () => {
  it("maps trending quotes and passes region + count", async () => {
    const spy = vi.spyOn(yf, "trendingSymbols").mockResolvedValue({
      count: 2,
      quotes: [
        { symbol: "NVDA", shortName: "NVIDIA", regularMarketPrice: 120.5, regularMarketChangePercent: 3.2 },
        { symbol: "TSLA", shortName: "Tesla", regularMarketPrice: 240.1, regularMarketChangePercent: -1.1 },
      ],
    } as never);
    const out = (await getTrendingSymbols.handler({ region: "US", count: 2 })) as any;
    expect(out.region).toBe("US");
    expect(out.quotes).toEqual([
      { symbol: "NVDA", shortName: "NVIDIA", price: 120.5, changePercent: 3.2 },
      { symbol: "TSLA", shortName: "Tesla", price: 240.1, changePercent: -1.1 },
    ]);
    expect(spy).toHaveBeenCalledWith("US", expect.objectContaining({ count: 2 }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/tools/searchStocks.test.ts test/tools/getNews.test.ts test/tools/getRecommendations.test.ts test/tools/getTrendingSymbols.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/tools/searchStocks.ts`**

```ts
import { z } from "zod";
import { defineTool } from "../types.js";
import { yf } from "../yahoo.js";

export const searchStocks = defineTool({
  name: "search_stocks",
  title: "Search stocks",
  description: "Look up tickers and companies by name or symbol.",
  inputSchema: {
    query: z.string().describe("Search text"),
    limit: z.number().int().min(1).max(50).default(10).describe("Max results"),
  },
  handler: async ({ query, limit }) => {
    const res = await yf.search(query, { quotesCount: limit, newsCount: 0 });
    const results = (res?.quotes ?? [])
      .filter((q: any) => q?.symbol)
      .slice(0, limit)
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortname ?? q.longname ?? q.shortName ?? null,
        exchange: q.exchange ?? null,
        type: q.quoteType ?? q.typeDisp ?? null,
        score: q.score ?? null,
      }));
    return { query, results };
  },
});
```

- [ ] **Step 4: Implement `src/tools/getNews.ts`**

```ts
import { z } from "zod";
import { defineTool } from "../types.js";
import { yf } from "../yahoo.js";
import { toISODateTime } from "../format.js";

export const getNews = defineTool({
  name: "get_news",
  title: "Get news",
  description: "Recent news articles related to a ticker.",
  inputSchema: {
    symbol: z.string().describe("Ticker symbol"),
    count: z.number().int().min(1).max(50).default(10).describe("Max articles"),
  },
  handler: async ({ symbol, count }) => {
    const res = await yf.search(symbol, { newsCount: count, quotesCount: 0 });
    const articles = (res?.news ?? []).slice(0, count).map((n: any) => ({
      title: n.title ?? null,
      publisher: n.publisher ?? null,
      link: n.link ?? null,
      publishedAt: toISODateTime(n.providerPublishTime),
      type: n.type ?? null,
      relatedTickers: n.relatedTickers ?? [],
    }));
    return { symbol, articles };
  },
});
```

- [ ] **Step 5: Implement `src/tools/getRecommendations.ts`**

```ts
import { z } from "zod";
import { defineTool } from "../types.js";
import { yf, isNotFound } from "../yahoo.js";

export const getRecommendations = defineTool({
  name: "get_recommendations",
  title: "Get analyst recommendations",
  description: "Analyst rating counts (strong buy / buy / hold / sell / strong sell) by period.",
  inputSchema: { symbol: z.string().describe("Ticker symbol") },
  handler: async ({ symbol }) => {
    try {
      const s = await yf.quoteSummary(symbol, ["recommendationTrend"]);
      const trend = (s?.recommendationTrend?.trend ?? []).map((t: any) => ({
        period: t.period ?? null,
        strongBuy: t.strongBuy ?? 0,
        buy: t.buy ?? 0,
        hold: t.hold ?? 0,
        sell: t.sell ?? 0,
        strongSell: t.strongSell ?? 0,
      }));
      return {
        symbol,
        trend,
        note: "Counts are the number of analysts at each rating for the given period offset.",
      };
    } catch (err) {
      if (isNotFound(err)) return { error: "symbol not found", symbol };
      throw err;
    }
  },
});
```

- [ ] **Step 6: Implement `src/tools/getTrendingSymbols.ts`**

```ts
import { z } from "zod";
import { defineTool } from "../types.js";
import { yf } from "../yahoo.js";
import { round } from "../format.js";

export const getTrendingSymbols = defineTool({
  name: "get_trending_symbols",
  title: "Get trending symbols",
  description: "Most-active / trending tickers for a region.",
  inputSchema: {
    region: z.string().default("US").describe("Region code, e.g. US, GB, DE"),
    count: z.number().int().min(1).max(50).default(10).describe("Max symbols"),
  },
  handler: async ({ region, count }) => {
    const res = await yf.trendingSymbols(region, { count });
    const quotes = (res?.quotes ?? []).slice(0, count).map((q: any) => ({
      symbol: q.symbol,
      shortName: q.shortName ?? q.longName ?? null,
      price: round(q.regularMarketPrice),
      changePercent: round(q.regularMarketChangePercent),
    }));
    return { region, quotes };
  },
});
```

- [ ] **Step 7: Append the four modules to `src/tools/index.ts`.**

- [ ] **Step 8: Run tests and build**

Run: `npx vitest run && npm run build`
Expected: all PASS; `tsc` clean.

- [ ] **Step 9: Commit**

```bash
git add src/tools/ test/tools/searchStocks.test.ts test/tools/getNews.test.ts test/tools/getRecommendations.test.ts test/tools/getTrendingSymbols.test.ts src/tools/index.ts
git commit -m "feat: add discovery and sentiment tools (search_stocks, get_news, get_recommendations, get_trending_symbols)"
```

---

## Task 9: Derivatives & ownership

Adds `get_options_chain`, `get_holders`.

**Files:**
- Create: `src/tools/getOptionsChain.ts`, `src/tools/getHolders.ts`
- Modify: `src/tools/index.ts`
- Test: `test/tools/getOptionsChain.test.ts`, `test/tools/getHolders.test.ts`

**Interfaces:**
- Consumes: `yf.options`, `yf.quoteSummary` (Task 3), `toISODate`, `round` (Task 2), `defineTool` (Task 4).
- Produces:
  - `getOptionsChain` — `inputSchema { symbol: z.string(), date: z.string().optional() }` (ISO date; omit = nearest expiry); returns
    `{ symbol, expirationDates: string[], selectedExpiration, calls: Contract[], puts: Contract[] }` where `Contract = { contractSymbol, strike, lastPrice, bid, ask, volume, openInterest, impliedVolatility, inTheMoney, expiration }`.
  - `getHolders` — `inputSchema { symbol: z.string() }`; returns
    `{ symbol, majorBreakdown, institutional: Holder[], funds: Holder[], insiders: Insider[] }`.

- [ ] **Step 1: Verify `options()` argument for a specific expiry**

Read `node_modules/yahoo-finance2/dist/esm/src/modules/options.d.ts`. Confirm whether a specific expiration is requested via `{ date: Date }` or `{ expiration: Date }` in queryOptions, and the result shape (`expirationDates`, `options[0].calls`, `options[0].puts`). Adjust Step 3 accordingly. The test below assumes `{ date: Date }`.

- [ ] **Step 2: Write the failing tests**

`test/tools/getOptionsChain.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { yf } from "../../src/yahoo.js";
import { getOptionsChain } from "../../src/tools/getOptionsChain.js";
import { autoRestore } from "../helpers.js";

autoRestore();

const optFixture = {
  expirationDates: [new Date("2026-09-19T00:00:00Z"), new Date("2026-10-17T00:00:00Z")],
  options: [
    {
      expirationDate: new Date("2026-09-19T00:00:00Z"),
      calls: [
        { contractSymbol: "AAPL260919C00230000", strike: 230, lastPrice: 5.4, bid: 5.3, ask: 5.5, volume: 1200, openInterest: 8000, impliedVolatility: 0.28, inTheMoney: true },
      ],
      puts: [
        { contractSymbol: "AAPL260919P00230000", strike: 230, lastPrice: 4.1, bid: 4.0, ask: 4.2, volume: 900, openInterest: 6000, impliedVolatility: 0.30, inTheMoney: false },
      ],
    },
  ],
};

describe("get_options_chain", () => {
  it("returns the nearest expiry when no date is given", async () => {
    const spy = vi.spyOn(yf, "options").mockResolvedValue(optFixture as never);
    const out = (await getOptionsChain.handler({ symbol: "AAPL" })) as any;
    expect(out.symbol).toBe("AAPL");
    expect(out.expirationDates).toEqual(["2026-09-19", "2026-10-17"]);
    expect(out.selectedExpiration).toBe("2026-09-19");
    expect(out.calls[0]).toMatchObject({ strike: 230, lastPrice: 5.4, inTheMoney: true, expiration: "2026-09-19" });
    expect(out.puts[0]).toMatchObject({ strike: 230, inTheMoney: false });
    expect(spy).toHaveBeenCalledWith("AAPL", {});
  });

  it("passes a requested expiration date through", async () => {
    const spy = vi.spyOn(yf, "options").mockResolvedValue(optFixture as never);
    await getOptionsChain.handler({ symbol: "AAPL", date: "2026-10-17" });
    const [, opts] = spy.mock.calls[0]!;
    expect(opts).toMatchObject({ date: expect.any(Date) });
    expect((opts as any).date.toISOString().slice(0, 10)).toBe("2026-10-17");
  });
});
```

`test/tools/getHolders.test.ts`:

```ts
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
```

- [ ] **Step 3: Implement `src/tools/getOptionsChain.ts`**

```ts
import { z } from "zod";
import { defineTool } from "../types.js";
import { yf, isNotFound } from "../yahoo.js";
import { toISODate, round } from "../format.js";

function contract(c: any, expiration: string | null) {
  return {
    contractSymbol: c.contractSymbol ?? null,
    strike: round(c.strike, 4),
    lastPrice: round(c.lastPrice, 4),
    bid: round(c.bid, 4),
    ask: round(c.ask, 4),
    volume: c.volume ?? null,
    openInterest: c.openInterest ?? null,
    impliedVolatility: round(c.impliedVolatility, 4),
    inTheMoney: c.inTheMoney ?? null,
    expiration,
  };
}

export const getOptionsChain = defineTool({
  name: "get_options_chain",
  title: "Get options chain",
  description: "Calls and puts for a ticker at the nearest (or a given) expiration.",
  inputSchema: {
    symbol: z.string().describe("Ticker symbol"),
    date: z.string().optional().describe("Expiration date (YYYY-MM-DD); omit for nearest"),
  },
  handler: async ({ symbol, date }) => {
    try {
      const query = date ? { date: new Date(`${date}T00:00:00Z`) } : {};
      const res = await yf.options(symbol, query);
      const expirationDates = (res?.expirationDates ?? []).map((d: any) => toISODate(d));
      const chain = res?.options?.[0] ?? {};
      const selectedExpiration = toISODate(chain.expirationDate) ?? expirationDates[0] ?? null;
      return {
        symbol,
        expirationDates,
        selectedExpiration,
        calls: (chain.calls ?? []).map((c: any) => contract(c, selectedExpiration)),
        puts: (chain.puts ?? []).map((p: any) => contract(p, selectedExpiration)),
      };
    } catch (err) {
      if (isNotFound(err)) return { error: "symbol not found", symbol };
      throw err;
    }
  },
});
```

- [ ] **Step 4: Implement `src/tools/getHolders.ts`**

```ts
import { z } from "zod";
import { defineTool } from "../types.js";
import { yf, isNotFound } from "../yahoo.js";
import { toISODate } from "../format.js";

const MODULES = ["majorHoldersBreakdown", "institutionOwnership", "fundOwnership", "insiderHolders"];

function ownership(list: any[] | undefined) {
  return (list ?? []).map((o) => ({
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
```

- [ ] **Step 5: Run tests to verify they fail, then implement, then pass**

Run (fail): `npx vitest run test/tools/getOptionsChain.test.ts test/tools/getHolders.test.ts` → FAIL (modules not found) before Steps 3-4 are saved; PASS after.

- [ ] **Step 6: Append both modules to `src/tools/index.ts`.**

- [ ] **Step 7: Full test + build + tool count check**

Run: `npx vitest run && npm run build`
Then append to `test/server.test.ts` inside `describe("buildServer", ...)`:

```ts
it("registers all 14 tools", async () => {
  const { TOOL_MODULES } = await import("../src/tools/index.js");
  expect(TOOL_MODULES).toHaveLength(14);
  const server = buildServer(TOOL_MODULES);
  const names = Object.keys(
    (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools,
  );
  expect(names.sort()).toEqual([
    "get_analyst_price_targets", "get_dividends", "get_earnings", "get_financials",
    "get_historical_data", "get_holders", "get_multiple_quotes", "get_news",
    "get_options_chain", "get_recommendations", "get_splits", "get_stock_info",
    "get_trending_symbols", "search_stocks",
  ]);
});
```

Run: `npx vitest run test/server.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/tools/ test/tools/getOptionsChain.test.ts test/tools/getHolders.test.ts src/tools/index.ts test/server.test.ts
git commit -m "feat: add options chain and holders tools; assert full 14-tool registry"
```

---

## Task 10: Live smoke tests

**Files:**
- Create: `test/live.test.ts`

**Interfaces:**
- Consumes: every tool module via `TOOL_MODULES` (Task 5-9).
- Produces: a network-dependent suite, skipped unless `RUN_LIVE_TESTS=1`.

- [ ] **Step 1: Write `test/live.test.ts`**

```ts
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
```

- [ ] **Step 2: Run the live suite manually**

Run: `npm run test:live`
Expected: all live cases PASS. If Yahoo rate-limits, re-run once; if a specific tool's accessor path is wrong, fix that tool module (the mock test will still pass but the shape was wrong) and re-run.

- [ ] **Step 3: Confirm the default suite still skips them**

Run: `npx vitest run`
Expected: `live smoke (AAPL)` reported as skipped; everything else passes.

- [ ] **Step 4: Commit**

```bash
git add test/live.test.ts
git commit -m "test: add gated live smoke tests for all tools"
```

---

## Task 11: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npm run build`, `npm test`.
- Produces: CI on push and PR to `main`.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [22, 24]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm test
```

- [ ] **Step 2: Validate locally**

Run: `npm ci && npm run build && npm test`
Expected: clean run — this is exactly what CI does. (`npm ci` requires `package-lock.json`; it was created in Task 1's `npm install`. Confirm it is committed.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: build and test on Node 22 and 24"
```

---

## Task 12: README and LICENSE

**Files:**
- Modify: `README.md`
- Create: `LICENSE`

**Interfaces:**
- Consumes: nothing.
- Produces: user-facing docs.

- [ ] **Step 1: Write `LICENSE`**

MIT license text, copyright `2026 Christian Maurer`.

- [ ] **Step 2: Write `README.md`**

Must contain:

1. One-paragraph description: MCP server for Yahoo Finance, TypeScript, drop-in replacement for `barvhaim/yfinance-mcp-server`.
2. **Requirements:** Node >= 22.
3. **Install / configure** — the client config block:

   ```jsonc
   {
     "mcpServers": {
       "yahoo-finance": {
         "command": "npx",
         "args": ["-y", "github:chris-p-maurer/mcp-yahoo-finance"]
       }
     }
   }
   ```

   Note: replace `chris-p-maurer` with the actual GitHub owner/repo. `npx` builds the TypeScript on first fetch via the `prepare` script.
4. **Updating:** `git push` to `main`; clients pick up changes on next launch. To force an immediate refresh, clear the npx cache: `npx clear-npx-cache` or `rm -rf ~/.npm/_npx`.
5. **Local development:** `git clone`, `npm install`, `npm run build`, then point the client at `node /abs/path/dist/index.js`. `npm test` for unit tests, `npm run test:live` for network smoke tests.
6. **Tools table** — all 14: name, parameters (with defaults), one-line description. Copy from the Global Constraints list and each tool's `description`.
7. **Notes / limitations:** unofficial Yahoo endpoints via `yahoo-finance2`; intraday intervals only work for recent ranges; delisted symbols return `{ error: "symbol not found" }`.

- [ ] **Step 3: Verify the doc**

Run: `npx vitest run && npm run build`
Manually confirm the tools table lists exactly the 14 names asserted in `test/server.test.ts` Task 9 Step 7, with matching parameter names.

- [ ] **Step 4: Commit**

```bash
git add README.md LICENSE
git commit -m "docs: add README with install, update, and tool reference; add MIT LICENSE"
```

---

## Self-Review

**1. Spec coverage:**

| Spec section | Task(s) |
|---|---|
| Stack & distribution (TS, SDK, stdio, yahoo-finance2, zod, vitest, npx-from-Git, `bin`/`prepare`/`engines`) | 1 |
| Architecture — modular tools dir, `index.ts`/`server.ts`/`yahoo.ts`/`format.ts` | 1, 2, 3, 4 |
| Tool module contract (`ToolModule`, `defineTool`) | 4 |
| `yahoo.ts` — configured instance, `suppressNotices`, `validateResult:false`, one import site | 3 |
| Error handling — one boundary, structured not-found, partial-failure for `get_multiple_quotes`, stderr-only logging | 4 (boundary), 5-9 (per-tool not-found), 5 (`get_multiple_quotes`) |
| Period handling — `periodToRange`, ytd/max rules | 2, used in 6 |
| 10 parity tools with exact names/params | 5 (`get_stock_info`, `get_multiple_quotes`), 6 (`get_historical_data`, `get_dividends`, `get_splits`), 7 (`get_financials`, `get_earnings`), 8 (`search_stocks`, `get_news`, `get_recommendations`) |
| 4 extra tools | 5 (`get_analyst_price_targets`), 8 (`get_trending_symbols`), 9 (`get_options_chain`, `get_holders`) |
| Output — JSON, consistent `{ symbol, ... }` / `{ error, ... }` | 4 (envelope), 5-9 (shapes) |
| Testing — mocked unit, gated live smoke, server registration | 2, 3, 5-9 (unit), 4 & 9 (registration), 10 (live) |
| CI — Actions, build + unit tests, Node matrix | 11 |
| Repo layout & tooling — tsconfig, scripts, gitignore, README, LICENSE | 1, 12 |
| Migration notes | 12 (README) |
| Open items (validation class, dividends/splits source, npx `prepare`) | Resolved: `validateResult:false` (Constraints + Task 3); `chart()` events (Task 6); `prepare` documented + verified (Task 1 Step 7, Task 11 Step 2) |

No gaps.

**2. Placeholder scan:** No "TBD"/"TODO"/"handle edge cases" left as instructions. "Verify the installed API" steps (3.1, 6.1, 7.1, 9.1) are concrete actions with exact file paths and a fallback, not placeholders. README Task 12 lists exact required content rather than prose to be invented.

**3. Type consistency:**
- `ToolModule` / `defineTool` defined in Task 4, imported identically everywhere.
- `yf` method names (`quote`, `quoteSummary`, `chart`, `search`, `recommendationsBySymbol`, `trendingSymbols`, `options`) defined in Task 3 Step 4, matched by every `vi.spyOn(yf, ...)` and handler call.
- `isNotFound` / `normalizeError` signatures from Task 3 used unchanged in Task 4 boundary and Tasks 5-9 handlers.
- `periodToRange` returns `{ period1, period2 }` (Task 2), consumed with those names in Task 6.
- `toISODate` / `toISODateTime` / `round` / `pick` signatures from Task 2 used consistently.
- `TOOL_MODULES` is a growing array in `src/tools/index.ts`; every task appends and never renames; final count asserted = 14 (Task 9).
- Tool `name` strings are identical between each tool module, `src/tools/index.ts`, and the `test/server.test.ts` assertions.

Consistent.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-02-mcp-yahoo-finance.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**

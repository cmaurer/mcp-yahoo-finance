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

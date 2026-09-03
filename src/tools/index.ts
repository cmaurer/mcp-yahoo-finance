import type { ToolModule } from "../types.js";
import { getStockInfo } from "./getStockInfo.js";
import { getMultipleQuotes } from "./getMultipleQuotes.js";
import { getAnalystPriceTargets } from "./getAnalystPriceTargets.js";
import { getHistoricalData } from "./getHistoricalData.js";
import { getDividends } from "./getDividends.js";
import { getSplits } from "./getSplits.js";
import { getFinancials } from "./getFinancials.js";
import { getEarnings } from "./getEarnings.js";
import { searchStocks } from "./searchStocks.js";
import { getNews } from "./getNews.js";
import { getRecommendations } from "./getRecommendations.js";
import { getTrendingSymbols } from "./getTrendingSymbols.js";
import { getOptionsChain } from "./getOptionsChain.js";
import { getHolders } from "./getHolders.js";

// Ruling A: concrete `ToolModule<{ symbol: ... }>` values that later tasks push
// here are not assignable to `ToolModule<z.ZodRawShape>` because of
// function-parameter contravariance on `handler`. Typing the array element as
// `ToolModule<any>` is the smallest change that compiles; `defineTool<S>` still
// gives tool authors full input-type inference at the call site, and
// `buildServer` casts when invoking the handler so runtime is unchanged.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TOOL_MODULES: ToolModule<any>[] = [
  getStockInfo,
  getMultipleQuotes,
  getAnalystPriceTargets,
  getHistoricalData,
  getDividends,
  getSplits,
  getFinancials,
  getEarnings,
  searchStocks,
  getNews,
  getRecommendations,
  getTrendingSymbols,
  getOptionsChain,
  getHolders,
];

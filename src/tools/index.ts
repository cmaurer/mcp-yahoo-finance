import type { ToolModule } from "../types.js";

// Ruling A: concrete `ToolModule<{ symbol: ... }>` values that later tasks push
// here are not assignable to `ToolModule<z.ZodRawShape>` because of
// function-parameter contravariance on `handler`. Typing the array element as
// `ToolModule<any>` is the smallest change that compiles; `defineTool<S>` still
// gives tool authors full input-type inference at the call site, and
// `buildServer` casts when invoking the handler so runtime is unchanged.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TOOL_MODULES: ToolModule<any>[] = [];

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

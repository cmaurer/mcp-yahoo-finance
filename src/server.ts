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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildServer(modules: ToolModule<any>[] = TOOL_MODULES): McpServer {
  const server = new McpServer({ name: "mcp-yahoo-finance", version: "0.1.0" });

  // SDK 1.30 wires up the tools/list + tools/call request handlers lazily on the
  // first registerTool call, so an empty registry would answer tools/list with
  // "Method not found". Force them on now; the call is idempotent (guarded by
  // the SDK's own _toolHandlersInitialized flag) so later registerTool calls are
  // unaffected.
  (server as unknown as { setToolRequestHandlers(): void }).setToolRequestHandlers();

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

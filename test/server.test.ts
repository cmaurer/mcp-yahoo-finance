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

// McpServer@1.30 keeps registered tools on the private `_registeredTools`
// record; each entry stores the raw callback on `.handler` (the brief's
// `.callback` name is used for prompts, not tools, in this SDK version).
type ToolEntry = { handler: (a: unknown) => Promise<unknown> };

function registry(server: ReturnType<typeof buildServer>): Record<string, ToolEntry> {
  return (server as unknown as { _registeredTools: Record<string, ToolEntry> })._registeredTools;
}

async function callTool(server: ReturnType<typeof buildServer>, name: string, args: unknown) {
  const entry = registry(server)[name];
  if (!entry) throw new Error(`tool ${name} not registered`);
  return entry.handler(args) as Promise<{ content: { text: string }[]; isError?: boolean }>;
}

describe("buildServer", () => {
  it("registers every provided module by name", () => {
    const server = buildServer([ok, boom]);
    expect(Object.keys(registry(server))).toEqual(
      expect.arrayContaining(["echo_ok", "always_throws"]),
    );
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

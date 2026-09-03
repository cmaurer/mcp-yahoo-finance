import { afterEach, vi } from "vitest";

export function autoRestore(): void {
  afterEach(() => vi.restoreAllMocks());
}

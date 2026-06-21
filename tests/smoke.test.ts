import { describe, it, expect } from "vitest";

describe("test infrastructure smoke", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });

  it("resolves @/ alias to src", async () => {
    const mod = await import("@/lib/ai/recipe");
    expect(typeof mod.classifyUrl).toBe("function");
  });
});

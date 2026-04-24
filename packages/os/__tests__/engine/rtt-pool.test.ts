import { describe, it, expect, beforeEach } from "vitest";
import { RTTPool } from "../../src/engine/rtt-pool";

describe("RTTPool", () => {
  let pool: RTTPool;
  beforeEach(() => { pool = new RTTPool(); });

  it("acquires a render target with given dimensions", () => {
    const rt = pool.acquire("win-1", 800, 600);
    expect(rt.width).toBe(800);
    expect(rt.height).toBe(600);
  });

  it("returns the same target for the same id", () => {
    const rt1 = pool.acquire("win-1", 800, 600);
    const rt2 = pool.acquire("win-1", 800, 600);
    expect(rt1).toBe(rt2);
  });

  it("resizes an existing target", () => {
    pool.acquire("win-1", 800, 600);
    const rt = pool.acquire("win-1", 1024, 768);
    expect(rt.width).toBe(1024);
    expect(rt.height).toBe(768);
  });

  it("releases a target", () => {
    pool.acquire("win-1", 800, 600);
    pool.release("win-1");
    expect(pool.has("win-1")).toBe(false);
  });

  it("disposes all targets", () => {
    pool.acquire("a", 100, 100);
    pool.acquire("b", 200, 200);
    pool.dispose();
    expect(pool.has("a")).toBe(false);
    expect(pool.has("b")).toBe(false);
  });
});

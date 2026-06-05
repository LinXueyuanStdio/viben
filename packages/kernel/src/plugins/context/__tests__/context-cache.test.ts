import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { ContextCache } from "../context-cache.js";
import type { ContextResult } from "../context-provider.js";

function makeCacheDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "viben-cache-test-"));
}

function makeResult(overrides: Partial<ContextResult> = {}): ContextResult {
  return {
    markdown: "# Test Context",
    tokenEstimate: 500,
    sessionCount: 1,
    totalTurns: 3,
    mode: "full",
    truncated: false,
    timeRange: { start: "2024-01-01T10:00:00Z", end: "2024-01-01T11:00:00Z" },
    ...overrides,
  };
}

describe("ContextCache", () => {
  let cacheDir: string;
  let cache: ContextCache;

  beforeEach(() => {
    cacheDir = makeCacheDir();
    cache = new ContextCache(cacheDir);
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it("creates cache directory on construction", () => {
    const newDir = path.join(cacheDir, "sub", "dir");
    new ContextCache(newDir);
    expect(fs.existsSync(newDir)).toBe(true);
  });

  it("returns null on cache miss", () => {
    const result = cache.get("/some/repo", "branch:main::");
    expect(result).toBeNull();
  });

  it("stores and retrieves a ContextResult", () => {
    const original = makeResult();
    cache.set("/some/repo", "branch:main::", original);
    const retrieved = cache.get("/some/repo", "branch:main::");
    expect(retrieved).toEqual(original);
  });

  it("returns null after TTL expires", () => {
    // Use a short TTL and fake timers to reliably test expiry
    const shortTtl = new ContextCache(cacheDir, 1000);
    const result = makeResult();
    shortTtl.set("/some/repo", "ttl-key::", result);

    // Advance time past the TTL
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 2000);
    try {
      const retrieved = shortTtl.get("/some/repo", "ttl-key::");
      expect(retrieved).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("different repo paths produce different cache entries", () => {
    const resultA = makeResult({ markdown: "# Repo A" });
    const resultB = makeResult({ markdown: "# Repo B" });

    cache.set("/repo/a", "branch:main::", resultA);
    cache.set("/repo/b", "branch:main::", resultB);

    expect(cache.get("/repo/a", "branch:main::")).toEqual(resultA);
    expect(cache.get("/repo/b", "branch:main::")).toEqual(resultB);
  });

  it("different query keys produce different cache entries", () => {
    const resultA = makeResult({ markdown: "# Main" });
    const resultB = makeResult({ markdown: "# Feature" });

    cache.set("/repo", "branch:main::", resultA);
    cache.set("/repo", "branch:feature::", resultB);

    expect(cache.get("/repo", "branch:main::")).toEqual(resultA);
    expect(cache.get("/repo", "branch:feature::")).toEqual(resultB);
  });

  it("overwrites existing cache entry on set", () => {
    const original = makeResult({ markdown: "# Original" });
    const updated = makeResult({ markdown: "# Updated" });

    cache.set("/repo", "branch:main::", original);
    cache.set("/repo", "branch:main::", updated);

    const retrieved = cache.get("/repo", "branch:main::");
    expect(retrieved).toEqual(updated);
  });

  it("deletes expired file from disk when TTL expires", () => {
    const shortTtl = new ContextCache(cacheDir, 1000);
    const result = makeResult();

    shortTtl.set("/repo", "key::", result);

    // Count files before get (should be 1)
    const filesBefore = fs.readdirSync(cacheDir).filter(f => f.endsWith(".json"));
    expect(filesBefore.length).toBeGreaterThan(0);

    // Advance time past TTL so the entry expires, then get should clean up the file
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 2000);
    try {
      shortTtl.get("/repo", "key::");
    } finally {
      vi.useRealTimers();
    }

    const filesAfter = fs.readdirSync(cacheDir).filter(f => f.endsWith(".json"));
    expect(filesAfter.length).toBe(0);
  });

  it("returns null for corrupt cache file", () => {
    // Manually write a corrupt JSON file where the cache entry would be
    cache.set("/repo", "corrupt-key::", makeResult());
    // Find the written file and corrupt it
    const files = fs.readdirSync(cacheDir).filter(f => f.endsWith(".json"));
    expect(files.length).toBe(1);
    fs.writeFileSync(path.join(cacheDir, files[0]), "not valid json{{{");

    const result = cache.get("/repo", "corrupt-key::");
    expect(result).toBeNull();
  });
});

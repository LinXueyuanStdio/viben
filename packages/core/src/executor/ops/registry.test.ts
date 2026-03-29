import { describe, it, expect } from "vitest";

// Import engines to register them
import "../engines";

import {
  getExecutor,
  hasExecutor,
  getRegisteredTypes,
  getAvailableExecutors,
} from "./registry";

describe("executor/ops/registry", () => {
  describe("hasExecutor", () => {
    it("should return true for CLAUDE_CODE", () => {
      expect(hasExecutor("CLAUDE_CODE")).toBe(true);
    });

    it("should return true for GEMINI", () => {
      expect(hasExecutor("GEMINI")).toBe(true);
    });

    it("should return false for unregistered types", () => {
      // CODEX is not implemented in Phase 1
      expect(hasExecutor("CODEX")).toBe(false);
    });
  });

  describe("getExecutor", () => {
    it("should return executor for CLAUDE_CODE", () => {
      const executor = getExecutor("CLAUDE_CODE");
      expect(executor).toBeDefined();
      expect(executor.type).toBe("CLAUDE_CODE");
    });

    it("should return executor for GEMINI", () => {
      const executor = getExecutor("GEMINI");
      expect(executor).toBeDefined();
      expect(executor.type).toBe("GEMINI");
    });

    it("should throw for unregistered type", () => {
      expect(() => getExecutor("CODEX")).toThrow("Unknown executor type: CODEX");
    });

    it("should pass config to factory", () => {
      const executor = getExecutor("CLAUDE_CODE", { model: "opus" });
      expect(executor).toBeDefined();
    });
  });

  describe("getRegisteredTypes", () => {
    it("should return array containing CLAUDE_CODE and GEMINI", () => {
      const types = getRegisteredTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types).toContain("CLAUDE_CODE");
      expect(types).toContain("GEMINI");
    });
  });

  describe("getAvailableExecutors", () => {
    it("should return array of executor info objects", () => {
      const available = getAvailableExecutors();
      expect(Array.isArray(available)).toBe(true);

      // Each entry should have type, executor, and availability
      for (const entry of available) {
        expect(entry).toHaveProperty("type");
        expect(entry).toHaveProperty("executor");
        expect(entry).toHaveProperty("availability");
        expect(entry.availability).toHaveProperty("status");
      }
    });
  });
});

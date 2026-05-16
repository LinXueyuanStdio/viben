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

    it("should return true for all implemented types", () => {
      // All executor types are now implemented
      expect(hasExecutor("CODEX")).toBe(true);
      expect(hasExecutor("AMP")).toBe(true);
      expect(hasExecutor("OPENCODE")).toBe(true);
      expect(hasExecutor("CURSOR_AGENT")).toBe(true);
      expect(hasExecutor("QWEN_CODE")).toBe(true);
      expect(hasExecutor("COPILOT")).toBe(true);
      expect(hasExecutor("DROID")).toBe(true);
    });

    it("should return false for invalid types", () => {
      expect(hasExecutor("INVALID_TYPE" as never)).toBe(false);
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

    it("should throw for invalid type", () => {
      expect(() => getExecutor("INVALID_TYPE" as never)).toThrow("Unknown executor type: INVALID_TYPE");
    });

    it("should return executor for CODEX", () => {
      const executor = getExecutor("CODEX");
      expect(executor).toBeDefined();
      expect(executor.type).toBe("CODEX");
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

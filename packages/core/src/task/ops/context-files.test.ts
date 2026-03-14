/**
 * Task Context Files Operations Tests
 *
 * Tests for context JSONL file management:
 * - initContext: Initialize empty context files (implement.jsonl, check.jsonl, fix.jsonl)
 * - addContext: Add files to task context
 * - removeContext: Remove files from context
 * - listContext: List context entries
 * - validateContext: Validate referenced files exist
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import {
  initContext,
  addContext,
  removeContext,
  listContext,
  validateContext,
} from "./context-files";

// Mock node:fs
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  statSync: vi.fn(),
}));

// Mock viben-workspace functions
vi.mock("../../cli/lib/viben-workspace", () => ({
  resolveTaskDirectory: vi.fn(),
  readJsonlFile: vi.fn(),
  writeJsonlFile: vi.fn(),
  appendToJsonl: vi.fn(),
  jsonlEntryExists: vi.fn(),
  updateTaskField: vi.fn(),
  DIR_VIBEN: ".viben",
}));

// Get mocked functions
import * as fs from "node:fs";
import * as vibenWorkspace from "../../cli/lib/viben-workspace";

describe("context-files operations", () => {
  const mockRepoRoot = "/mock/repo";
  const mockTaskDir = join(mockRepoRoot, ".viben/tasks/03-15-test-task");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(vibenWorkspace.resolveTaskDirectory).mockReturnValue(mockTaskDir);
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initContext", () => {
    it("should initialize empty context files", () => {
      const result = initContext(mockRepoRoot, "test-task");

      expect(result.success).toBe(true);
      expect(result.taskDir).toBe(mockTaskDir);
      expect(result.files).toEqual({
        implement: 0,
        check: 0,
        fix: 0,
      });

      // Should create three JSONL files
      expect(vi.mocked(vibenWorkspace.writeJsonlFile)).toHaveBeenCalledTimes(3);
      expect(vi.mocked(vibenWorkspace.writeJsonlFile)).toHaveBeenCalledWith(
        join(mockTaskDir, "implement.jsonl"),
        []
      );
      expect(vi.mocked(vibenWorkspace.writeJsonlFile)).toHaveBeenCalledWith(
        join(mockTaskDir, "check.jsonl"),
        []
      );
      expect(vi.mocked(vibenWorkspace.writeJsonlFile)).toHaveBeenCalledWith(
        join(mockTaskDir, "fix.jsonl"),
        []
      );
    });

    it("should return error when task not found", () => {
      vi.mocked(vibenWorkspace.resolveTaskDirectory).mockReturnValue(null);

      const result = initContext(mockRepoRoot, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
      expect(result.files).toEqual({ implement: 0, check: 0, fix: 0 });
    });

    it("should return error when task directory does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = initContext(mockRepoRoot, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });
  });

  describe("addContext", () => {
    beforeEach(() => {
      vi.mocked(vibenWorkspace.jsonlEntryExists).mockReturnValue(false);
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as any);
    });

    it("should add files to implement.jsonl by default", () => {
      const result = addContext(mockRepoRoot, "test-task", [
        "src/index.ts",
        "src/utils.ts",
      ]);

      expect(result.success).toBe(true);
      expect(result.added).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.total).toBe(2);

      expect(vi.mocked(vibenWorkspace.appendToJsonl)).toHaveBeenCalledTimes(2);
      expect(vi.mocked(vibenWorkspace.appendToJsonl)).toHaveBeenCalledWith(
        join(mockTaskDir, "implement.jsonl"),
        expect.objectContaining({
          file: "src/index.ts",
          reason: "Added by user",
          type: "file",
        })
      );
    });

    it("should add files to specified context type", () => {
      const result = addContext(mockRepoRoot, "test-task", ["src/test.ts"], {
        contextType: "check",
      });

      expect(result.success).toBe(true);
      expect(vi.mocked(vibenWorkspace.appendToJsonl)).toHaveBeenCalledWith(
        join(mockTaskDir, "check.jsonl"),
        expect.any(Object)
      );
    });

    it("should use custom reason when provided", () => {
      const result = addContext(mockRepoRoot, "test-task", ["src/index.ts"], {
        reason: "Core module",
      });

      expect(result.success).toBe(true);
      expect(vi.mocked(vibenWorkspace.appendToJsonl)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          file: "src/index.ts",
          reason: "Core module",
        })
      );
    });

    it("should skip files that already exist in context", () => {
      vi.mocked(vibenWorkspace.jsonlEntryExists)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      const result = addContext(mockRepoRoot, "test-task", [
        "src/existing.ts",
        "src/new.ts",
      ]);

      expect(result.success).toBe(true);
      expect(result.added).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.total).toBe(2);
    });

    it("should detect directories vs files", () => {
      vi.mocked(fs.statSync)
        .mockReturnValueOnce({ isDirectory: () => true } as any)
        .mockReturnValueOnce({ isDirectory: () => false } as any);

      const result = addContext(mockRepoRoot, "test-task", [
        "src/components",
        "src/index.ts",
      ]);

      expect(result.success).toBe(true);
      expect(vi.mocked(vibenWorkspace.appendToJsonl)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          file: "src/components",
          type: "directory",
        })
      );
      expect(vi.mocked(vibenWorkspace.appendToJsonl)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          file: "src/index.ts",
          type: "file",
        })
      );
    });

    it("should return error when task not found", () => {
      vi.mocked(vibenWorkspace.resolveTaskDirectory).mockReturnValue(null);

      const result = addContext(mockRepoRoot, "nonexistent-task", ["src/index.ts"]);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
      expect(result.added).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.total).toBe(1);
    });

    it("should handle non-existent files gracefully", () => {
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(true) // Task directory exists
        .mockReturnValueOnce(false); // File doesn't exist

      const result = addContext(mockRepoRoot, "test-task", ["src/nonexistent.ts"]);

      expect(result.success).toBe(true);
      expect(result.added).toBe(1);
      // Entry should be added without type field
      expect(vi.mocked(vibenWorkspace.appendToJsonl)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          file: "src/nonexistent.ts",
        })
      );
    });

    it("should handle empty files array", () => {
      const result = addContext(mockRepoRoot, "test-task", []);

      expect(result.success).toBe(true);
      expect(result.added).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe("removeContext", () => {
    it("should remove files from all context files", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        '{"file": "src/index.ts", "reason": "test"}\n{"file": "src/utils.ts", "reason": "test"}'
      );

      const result = removeContext(mockRepoRoot, "test-task", ["src/index.ts"]);

      expect(result.success).toBe(true);
      expect(result.removed).toEqual(["src/index.ts"]);

      // Should update all three context files
      expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledTimes(3);
    });

    it("should return error when task not found", () => {
      vi.mocked(vibenWorkspace.resolveTaskDirectory).mockReturnValue(null);

      const result = removeContext(mockRepoRoot, "nonexistent-task", ["src/index.ts"]);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
      expect(result.removed).toEqual([]);
    });

    it("should handle multiple files to remove", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        '{"file": "src/a.ts", "reason": "test"}\n{"file": "src/b.ts", "reason": "test"}\n{"file": "src/c.ts", "reason": "test"}'
      );

      const result = removeContext(mockRepoRoot, "test-task", [
        "src/a.ts",
        "src/b.ts",
      ]);

      expect(result.success).toBe(true);
      expect(result.removed).toEqual(["src/a.ts", "src/b.ts"]);
    });

    it("should handle missing context files gracefully", () => {
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(true) // Task directory
        .mockReturnValueOnce(false) // implement.jsonl
        .mockReturnValueOnce(false) // check.jsonl
        .mockReturnValueOnce(false); // fix.jsonl

      const result = removeContext(mockRepoRoot, "test-task", ["src/index.ts"]);

      expect(result.success).toBe(true);
      expect(result.removed).toEqual(["src/index.ts"]);
    });

    it("should handle invalid JSON lines gracefully", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        '{"file": "src/valid.ts", "reason": "test"}\ninvalid json line\n{"file": "src/another.ts", "reason": "test"}'
      );

      const result = removeContext(mockRepoRoot, "test-task", ["src/valid.ts"]);

      expect(result.success).toBe(true);
      expect(result.removed).toEqual(["src/valid.ts"]);
    });
  });

  describe("listContext", () => {
    it("should list context entries from all files", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(vibenWorkspace.readJsonlFile)
        .mockReturnValueOnce([
          { file: "src/impl.ts", reason: "test" },
        ])
        .mockReturnValueOnce([
          { file: "src/check.ts", reason: "test" },
        ])
        .mockReturnValueOnce([
          { file: "src/fix.ts", reason: "test" },
        ]);

      const result = listContext(mockRepoRoot, "test-task");

      expect(result.success).toBe(true);
      expect(result.context["implement.jsonl"]).toHaveLength(1);
      expect(result.context["check.jsonl"]).toHaveLength(1);
      expect(result.context["fix.jsonl"]).toHaveLength(1);
    });

    it("should return error when task not found", () => {
      vi.mocked(vibenWorkspace.resolveTaskDirectory).mockReturnValue(null);

      const result = listContext(mockRepoRoot, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
      expect(result.context).toEqual({});
    });

    it("should handle missing context files", () => {
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(true) // Task directory
        .mockReturnValueOnce(true) // implement.jsonl exists
        .mockReturnValueOnce(false) // check.jsonl doesn't exist
        .mockReturnValueOnce(false); // fix.jsonl doesn't exist
      vi.mocked(vibenWorkspace.readJsonlFile).mockReturnValue([
        { file: "src/impl.ts", reason: "test" },
      ]);

      const result = listContext(mockRepoRoot, "test-task");

      expect(result.success).toBe(true);
      expect(result.context["implement.jsonl"]).toBeDefined();
      expect(result.context["check.jsonl"]).toBeUndefined();
      expect(result.context["fix.jsonl"]).toBeUndefined();
    });

    it("should return empty arrays for empty context files", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(vibenWorkspace.readJsonlFile).mockReturnValue([]);

      const result = listContext(mockRepoRoot, "test-task");

      expect(result.success).toBe(true);
      expect(result.context["implement.jsonl"]).toEqual([]);
    });
  });

  describe("validateContext", () => {
    it("should validate existing files as valid", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(vibenWorkspace.readJsonlFile).mockReturnValue([
        { file: "src/existing.ts", reason: "test" },
      ]);

      const result = validateContext(mockRepoRoot, "test-task");

      expect(result.success).toBe(true);
      expect(result.valid).toContain("src/existing.ts");
      expect(result.missing).toHaveLength(0);
    });

    it("should report missing files", () => {
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(true) // Task directory
        .mockReturnValueOnce(true) // implement.jsonl exists
        .mockReturnValueOnce(false) // check.jsonl doesn't exist
        .mockReturnValueOnce(false) // fix.jsonl doesn't exist
        .mockReturnValueOnce(false); // Referenced file doesn't exist
      vi.mocked(vibenWorkspace.readJsonlFile).mockReturnValue([
        { file: "src/missing.ts", reason: "test" },
      ]);

      const result = validateContext(mockRepoRoot, "test-task");

      expect(result.success).toBe(false);
      expect(result.missing).toContain("src/missing.ts");
      expect(result.valid).toHaveLength(0);
    });

    it("should handle mixed valid and missing files", () => {
      const existsMap: Record<string, boolean> = {
        [mockTaskDir]: true,
        [join(mockTaskDir, "implement.jsonl")]: true,
        [join(mockTaskDir, "check.jsonl")]: false,
        [join(mockTaskDir, "fix.jsonl")]: false,
        [join(mockRepoRoot, "src/valid.ts")]: true,
        [join(mockRepoRoot, "src/missing.ts")]: false,
      };
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return existsMap[path as string] ?? false;
      });
      vi.mocked(vibenWorkspace.readJsonlFile).mockReturnValue([
        { file: "src/valid.ts", reason: "test" },
        { file: "src/missing.ts", reason: "test" },
      ]);

      const result = validateContext(mockRepoRoot, "test-task");

      expect(result.success).toBe(false);
      expect(result.valid).toContain("src/valid.ts");
      expect(result.missing).toContain("src/missing.ts");
    });

    it("should return error when task not found", () => {
      vi.mocked(vibenWorkspace.resolveTaskDirectory).mockReturnValue(null);

      const result = validateContext(mockRepoRoot, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
      expect(result.valid).toEqual([]);
      expect(result.missing).toEqual([]);
    });

    it("should handle empty context files", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(vibenWorkspace.readJsonlFile).mockReturnValue([]);

      const result = validateContext(mockRepoRoot, "test-task");

      expect(result.success).toBe(true);
      expect(result.valid).toHaveLength(0);
      expect(result.missing).toHaveLength(0);
    });

    it("should validate files from all context types", () => {
      const existsMap: Record<string, boolean> = {
        [mockTaskDir]: true,
        [join(mockTaskDir, "implement.jsonl")]: true,
        [join(mockTaskDir, "check.jsonl")]: true,
        [join(mockTaskDir, "fix.jsonl")]: true,
        [join(mockRepoRoot, "src/impl.ts")]: true,
        [join(mockRepoRoot, "src/check.ts")]: true,
        [join(mockRepoRoot, "src/fix.ts")]: true,
      };
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return existsMap[path as string] ?? false;
      });
      vi.mocked(vibenWorkspace.readJsonlFile)
        .mockReturnValueOnce([{ file: "src/impl.ts", reason: "test" }])
        .mockReturnValueOnce([{ file: "src/check.ts", reason: "test" }])
        .mockReturnValueOnce([{ file: "src/fix.ts", reason: "test" }]);

      const result = validateContext(mockRepoRoot, "test-task");

      expect(result.success).toBe(true);
      expect(result.valid).toHaveLength(3);
      expect(result.valid).toContain("src/impl.ts");
      expect(result.valid).toContain("src/check.ts");
      expect(result.valid).toContain("src/fix.ts");
    });
  });
});

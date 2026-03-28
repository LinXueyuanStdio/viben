/**
 * Task Context Files Operations Tests
 *
 * Integration tests for context JSONL file management using real file system:
 * - initContext: Initialize empty context files (implement.jsonl, check.jsonl, fix.jsonl)
 * - addContext: Add files to task context
 * - removeContext: Remove files from context
 * - listContext: List context entries
 * - validateContext: Validate referenced files exist
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import {
  createWorkspaceTempDir,
  createTaskDir,
  type TempDirContext,
} from "../../test/helpers/temp-dir";
import {
  initContext,
  addContext,
  removeContext,
  listContext,
  validateContext,
} from "./context-files";

describe("context-files operations", () => {
  let tempDir: TempDirContext & { vibenDir: string; tasksDir: string };
  let taskDir: string;
  const TASK_NAME = "03-15-test-task";

  beforeEach(async () => {
    tempDir = await createWorkspaceTempDir();
    taskDir = await createTaskDir(tempDir, TASK_NAME);
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  describe("initContext", () => {
    it("should initialize empty context files", async () => {
      const result = initContext(tempDir.root, TASK_NAME);

      expect(result.success).toBe(true);
      expect(result.taskDir).toBe(taskDir);
      expect(result.files).toEqual({
        implement: 0,
        check: 0,
        fix: 0,
      });

      // Verify files were actually created
      expect(await tempDir.exists(`.viben/tasks/${TASK_NAME}/implement.jsonl`)).toBe(true);
      expect(await tempDir.exists(`.viben/tasks/${TASK_NAME}/check.jsonl`)).toBe(true);
      expect(await tempDir.exists(`.viben/tasks/${TASK_NAME}/fix.jsonl`)).toBe(true);

      // Verify files are empty (just newline)
      const implementContent = await tempDir.readFile(`.viben/tasks/${TASK_NAME}/implement.jsonl`);
      expect(implementContent.trim()).toBe("");
    });

    it("should return error when task not found", () => {
      const result = initContext(tempDir.root, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
      expect(result.files).toEqual({ implement: 0, check: 0, fix: 0 });
    });

    it("should overwrite existing context files", async () => {
      // First init
      initContext(tempDir.root, TASK_NAME);

      // Add some content
      await tempDir.writeFile(
        `.viben/tasks/${TASK_NAME}/implement.jsonl`,
        '{"file": "old.ts", "reason": "old"}\n'
      );

      // Re-init should create empty files
      const result = initContext(tempDir.root, TASK_NAME);

      expect(result.success).toBe(true);
      const content = await tempDir.readFile(`.viben/tasks/${TASK_NAME}/implement.jsonl`);
      expect(content.trim()).toBe("");
    });
  });

  describe("addContext", () => {
    beforeEach(async () => {
      // Initialize context files first
      initContext(tempDir.root, TASK_NAME);

      // Create some test files to add as context
      await tempDir.writeFile("src/index.ts", "export default {}");
      await tempDir.writeFile("src/utils.ts", "export const util = () => {}");
      await tempDir.mkdir("src/components");
    });

    it("should add files to implement.jsonl by default", async () => {
      const result = addContext(tempDir.root, TASK_NAME, [
        "src/index.ts",
        "src/utils.ts",
      ]);

      expect(result.success).toBe(true);
      expect(result.added).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.total).toBe(2);

      // Verify actual file content
      const content = await tempDir.readFile(`.viben/tasks/${TASK_NAME}/implement.jsonl`);
      const lines = content.trim().split("\n").filter(Boolean);
      expect(lines).toHaveLength(2);

      const entries = lines.map((line) => JSON.parse(line));
      expect(entries[0]).toMatchObject({
        file: "src/index.ts",
        reason: "Added by user",
        type: "file",
      });
      expect(entries[1]).toMatchObject({
        file: "src/utils.ts",
        reason: "Added by user",
        type: "file",
      });
    });

    it("should add files to specified context type", async () => {
      const result = addContext(tempDir.root, TASK_NAME, ["src/index.ts"], {
        contextType: "check",
      });

      expect(result.success).toBe(true);

      // Verify it went to check.jsonl
      const checkContent = await tempDir.readFile(`.viben/tasks/${TASK_NAME}/check.jsonl`);
      const lines = checkContent.trim().split("\n").filter(Boolean);
      expect(lines).toHaveLength(1);

      // Verify implement.jsonl is still empty
      const implementContent = await tempDir.readFile(`.viben/tasks/${TASK_NAME}/implement.jsonl`);
      expect(implementContent.trim()).toBe("");
    });

    it("should use custom reason when provided", async () => {
      const result = addContext(tempDir.root, TASK_NAME, ["src/index.ts"], {
        reason: "Core module",
      });

      expect(result.success).toBe(true);

      const content = await tempDir.readFile(`.viben/tasks/${TASK_NAME}/implement.jsonl`);
      const entry = JSON.parse(content.trim());
      expect(entry.reason).toBe("Core module");
    });

    it("should skip files that already exist in context", async () => {
      // Add first file
      addContext(tempDir.root, TASK_NAME, ["src/index.ts"]);

      // Try to add same file again along with new one
      const result = addContext(tempDir.root, TASK_NAME, [
        "src/index.ts",
        "src/utils.ts",
      ]);

      expect(result.success).toBe(true);
      expect(result.added).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.total).toBe(2);

      // Verify only 2 entries total (not 3)
      const content = await tempDir.readFile(`.viben/tasks/${TASK_NAME}/implement.jsonl`);
      const lines = content.trim().split("\n").filter(Boolean);
      expect(lines).toHaveLength(2);
    });

    it("should detect directories vs files", async () => {
      const result = addContext(tempDir.root, TASK_NAME, [
        "src/components",
        "src/index.ts",
      ]);

      expect(result.success).toBe(true);

      const content = await tempDir.readFile(`.viben/tasks/${TASK_NAME}/implement.jsonl`);
      const lines = content.trim().split("\n").filter(Boolean);
      const entries = lines.map((line) => JSON.parse(line));

      const componentEntry = entries.find((e) => e.file === "src/components");
      const indexEntry = entries.find((e) => e.file === "src/index.ts");

      expect(componentEntry?.type).toBe("directory");
      expect(indexEntry?.type).toBe("file");
    });

    it("should return error when task not found", () => {
      const result = addContext(tempDir.root, "nonexistent-task", ["src/index.ts"]);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
      expect(result.added).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.total).toBe(1);
    });

    it("should handle non-existent files gracefully (no type field)", async () => {
      const result = addContext(tempDir.root, TASK_NAME, ["src/nonexistent.ts"]);

      expect(result.success).toBe(true);
      expect(result.added).toBe(1);

      const content = await tempDir.readFile(`.viben/tasks/${TASK_NAME}/implement.jsonl`);
      const entry = JSON.parse(content.trim());

      expect(entry.file).toBe("src/nonexistent.ts");
      // Non-existent files should not have a type field
      expect(entry.type).toBeUndefined();
    });

    it("should handle empty files array", () => {
      const result = addContext(tempDir.root, TASK_NAME, []);

      expect(result.success).toBe(true);
      expect(result.added).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.total).toBe(0);
    });

    it("should append multiple entries correctly", async () => {
      addContext(tempDir.root, TASK_NAME, ["src/index.ts"]);
      addContext(tempDir.root, TASK_NAME, ["src/utils.ts"]);

      const content = await tempDir.readFile(`.viben/tasks/${TASK_NAME}/implement.jsonl`);
      const lines = content.trim().split("\n").filter(Boolean);
      expect(lines).toHaveLength(2);

      const paths = lines.map((l) => JSON.parse(l).file);
      expect(paths).toContain("src/index.ts");
      expect(paths).toContain("src/utils.ts");
    });
  });

  describe("removeContext", () => {
    beforeEach(async () => {
      initContext(tempDir.root, TASK_NAME);

      // Pre-populate context files
      await tempDir.writeFile(
        `.viben/tasks/${TASK_NAME}/implement.jsonl`,
        '{"file": "src/a.ts", "reason": "test"}\n{"file": "src/b.ts", "reason": "test"}\n{"file": "src/c.ts", "reason": "test"}\n'
      );
      await tempDir.writeFile(
        `.viben/tasks/${TASK_NAME}/check.jsonl`,
        '{"file": "src/a.ts", "reason": "check"}\n{"file": "src/d.ts", "reason": "check"}\n'
      );
    });

    it("should remove files from all context files", async () => {
      const result = removeContext(tempDir.root, TASK_NAME, ["src/a.ts"]);

      expect(result.success).toBe(true);
      expect(result.removed).toEqual(["src/a.ts"]);

      // Verify removed from implement.jsonl
      const implementContent = await tempDir.readFile(`.viben/tasks/${TASK_NAME}/implement.jsonl`);
      const implementLines = implementContent.trim().split("\n").filter(Boolean);
      expect(implementLines).toHaveLength(2);
      const implementPaths = implementLines.map((l) => JSON.parse(l).file);
      expect(implementPaths).not.toContain("src/a.ts");
      expect(implementPaths).toContain("src/b.ts");
      expect(implementPaths).toContain("src/c.ts");

      // Verify removed from check.jsonl
      const checkContent = await tempDir.readFile(`.viben/tasks/${TASK_NAME}/check.jsonl`);
      const checkLines = checkContent.trim().split("\n").filter(Boolean);
      expect(checkLines).toHaveLength(1);
      const checkPaths = checkLines.map((l) => JSON.parse(l).file);
      expect(checkPaths).not.toContain("src/a.ts");
      expect(checkPaths).toContain("src/d.ts");
    });

    it("should handle nonexistent task gracefully (returns success with files listed as removed)", () => {
      // Note: removeContext doesn't verify task existence, only that taskDir resolves
      // When task doesn't exist, it skips all files (they don't exist) and returns success
      const result = removeContext(tempDir.root, "nonexistent-task", ["src/a.ts"]);

      // This is the actual behavior - returns success since no files needed modification
      expect(result.success).toBe(true);
      expect(result.removed).toEqual(["src/a.ts"]);
    });

    it("should handle multiple files to remove", async () => {
      const result = removeContext(tempDir.root, TASK_NAME, ["src/a.ts", "src/b.ts"]);

      expect(result.success).toBe(true);
      expect(result.removed).toEqual(["src/a.ts", "src/b.ts"]);

      const content = await tempDir.readFile(`.viben/tasks/${TASK_NAME}/implement.jsonl`);
      const lines = content.trim().split("\n").filter(Boolean);
      expect(lines).toHaveLength(1);

      const entry = JSON.parse(lines[0]);
      expect(entry.file).toBe("src/c.ts");
    });

    it("should handle missing context files gracefully", async () => {
      // Remove all context files
      const fs = await import("node:fs/promises");
      await fs.unlink(join(tempDir.root, `.viben/tasks/${TASK_NAME}/implement.jsonl`));
      await fs.unlink(join(tempDir.root, `.viben/tasks/${TASK_NAME}/check.jsonl`));
      await fs.unlink(join(tempDir.root, `.viben/tasks/${TASK_NAME}/fix.jsonl`));

      const result = removeContext(tempDir.root, TASK_NAME, ["src/a.ts"]);

      expect(result.success).toBe(true);
      expect(result.removed).toEqual(["src/a.ts"]);
    });

    it("should handle invalid JSON lines gracefully", async () => {
      // Write content with invalid JSON line
      await tempDir.writeFile(
        `.viben/tasks/${TASK_NAME}/implement.jsonl`,
        '{"file": "src/valid.ts", "reason": "test"}\ninvalid json line\n{"file": "src/another.ts", "reason": "test"}\n'
      );

      const result = removeContext(tempDir.root, TASK_NAME, ["src/valid.ts"]);

      expect(result.success).toBe(true);
      expect(result.removed).toEqual(["src/valid.ts"]);

      // Invalid lines should be preserved
      const content = await tempDir.readFile(`.viben/tasks/${TASK_NAME}/implement.jsonl`);
      const lines = content.trim().split("\n").filter(Boolean);
      expect(lines).toHaveLength(2); // invalid line + another.ts

      // The invalid line should be preserved
      expect(lines[0]).toBe("invalid json line");
    });

    it("should handle removing non-existent files (no-op)", async () => {
      const result = removeContext(tempDir.root, TASK_NAME, ["src/nonexistent.ts"]);

      expect(result.success).toBe(true);
      expect(result.removed).toEqual(["src/nonexistent.ts"]);

      // Original content should be unchanged
      const content = await tempDir.readFile(`.viben/tasks/${TASK_NAME}/implement.jsonl`);
      const lines = content.trim().split("\n").filter(Boolean);
      expect(lines).toHaveLength(3);
    });
  });

  describe("listContext", () => {
    beforeEach(async () => {
      initContext(tempDir.root, TASK_NAME);
    });

    it("should list context entries from all files", async () => {
      await tempDir.writeFile(
        `.viben/tasks/${TASK_NAME}/implement.jsonl`,
        '{"file": "src/impl.ts", "reason": "impl"}\n'
      );
      await tempDir.writeFile(
        `.viben/tasks/${TASK_NAME}/check.jsonl`,
        '{"file": "src/check.ts", "reason": "check"}\n'
      );
      await tempDir.writeFile(
        `.viben/tasks/${TASK_NAME}/fix.jsonl`,
        '{"file": "src/fix.ts", "reason": "fix"}\n'
      );

      const result = listContext(tempDir.root, TASK_NAME);

      expect(result.success).toBe(true);
      expect(result.context["implement.jsonl"]).toHaveLength(1);
      expect(result.context["check.jsonl"]).toHaveLength(1);
      expect(result.context["fix.jsonl"]).toHaveLength(1);

      expect(result.context["implement.jsonl"][0].file).toBe("src/impl.ts");
      expect(result.context["check.jsonl"][0].file).toBe("src/check.ts");
      expect(result.context["fix.jsonl"][0].file).toBe("src/fix.ts");
    });

    it("should return error when task not found", () => {
      const result = listContext(tempDir.root, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
      expect(result.context).toEqual({});
    });

    it("should handle missing context files", async () => {
      // Remove check and fix files
      const fs = await import("node:fs/promises");
      await fs.unlink(join(tempDir.root, `.viben/tasks/${TASK_NAME}/check.jsonl`));
      await fs.unlink(join(tempDir.root, `.viben/tasks/${TASK_NAME}/fix.jsonl`));

      await tempDir.writeFile(
        `.viben/tasks/${TASK_NAME}/implement.jsonl`,
        '{"file": "src/impl.ts", "reason": "test"}\n'
      );

      const result = listContext(tempDir.root, TASK_NAME);

      expect(result.success).toBe(true);
      expect(result.context["implement.jsonl"]).toBeDefined();
      expect(result.context["check.jsonl"]).toBeUndefined();
      expect(result.context["fix.jsonl"]).toBeUndefined();
    });

    it("should return empty arrays for empty context files", async () => {
      const result = listContext(tempDir.root, TASK_NAME);

      expect(result.success).toBe(true);
      expect(result.context["implement.jsonl"]).toEqual([]);
      expect(result.context["check.jsonl"]).toEqual([]);
      expect(result.context["fix.jsonl"]).toEqual([]);
    });

    it("should parse multiple entries correctly", async () => {
      await tempDir.writeFile(
        `.viben/tasks/${TASK_NAME}/implement.jsonl`,
        '{"file": "a.ts", "reason": "r1"}\n{"file": "b.ts", "reason": "r2"}\n{"file": "c.ts", "reason": "r3"}\n'
      );

      const result = listContext(tempDir.root, TASK_NAME);

      expect(result.success).toBe(true);
      expect(result.context["implement.jsonl"]).toHaveLength(3);

      const files = result.context["implement.jsonl"].map((e) => e.file);
      expect(files).toEqual(["a.ts", "b.ts", "c.ts"]);
    });

    it("should skip invalid JSON lines", async () => {
      await tempDir.writeFile(
        `.viben/tasks/${TASK_NAME}/implement.jsonl`,
        '{"file": "valid.ts", "reason": "test"}\ninvalid json\n{"file": "also-valid.ts", "reason": "test"}\n'
      );

      const result = listContext(tempDir.root, TASK_NAME);

      expect(result.success).toBe(true);
      expect(result.context["implement.jsonl"]).toHaveLength(2);
    });
  });

  describe("validateContext", () => {
    beforeEach(async () => {
      initContext(tempDir.root, TASK_NAME);

      // Create some test files
      await tempDir.writeFile("src/existing.ts", "// exists");
      await tempDir.mkdir("src/existing-dir");
    });

    it("should validate existing files as valid", async () => {
      await tempDir.writeFile(
        `.viben/tasks/${TASK_NAME}/implement.jsonl`,
        '{"file": "src/existing.ts", "reason": "test"}\n'
      );

      const result = validateContext(tempDir.root, TASK_NAME);

      expect(result.success).toBe(true);
      expect(result.valid).toContain("src/existing.ts");
      expect(result.missing).toHaveLength(0);
    });

    it("should report missing files", async () => {
      await tempDir.writeFile(
        `.viben/tasks/${TASK_NAME}/implement.jsonl`,
        '{"file": "src/missing.ts", "reason": "test"}\n'
      );

      const result = validateContext(tempDir.root, TASK_NAME);

      expect(result.success).toBe(false);
      expect(result.missing).toContain("src/missing.ts");
      expect(result.valid).toHaveLength(0);
    });

    it("should handle mixed valid and missing files", async () => {
      await tempDir.writeFile(
        `.viben/tasks/${TASK_NAME}/implement.jsonl`,
        '{"file": "src/existing.ts", "reason": "test"}\n{"file": "src/missing.ts", "reason": "test"}\n'
      );

      const result = validateContext(tempDir.root, TASK_NAME);

      expect(result.success).toBe(false);
      expect(result.valid).toContain("src/existing.ts");
      expect(result.missing).toContain("src/missing.ts");
    });

    it("should return error when task not found", () => {
      const result = validateContext(tempDir.root, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
      expect(result.valid).toEqual([]);
      expect(result.missing).toEqual([]);
    });

    it("should handle empty context files", async () => {
      const result = validateContext(tempDir.root, TASK_NAME);

      expect(result.success).toBe(true);
      expect(result.valid).toHaveLength(0);
      expect(result.missing).toHaveLength(0);
    });

    it("should validate files from all context types", async () => {
      await tempDir.writeFile("src/impl.ts", "// impl");
      await tempDir.writeFile("src/check.ts", "// check");
      await tempDir.writeFile("src/fix.ts", "// fix");

      await tempDir.writeFile(
        `.viben/tasks/${TASK_NAME}/implement.jsonl`,
        '{"file": "src/impl.ts", "reason": "test"}\n'
      );
      await tempDir.writeFile(
        `.viben/tasks/${TASK_NAME}/check.jsonl`,
        '{"file": "src/check.ts", "reason": "test"}\n'
      );
      await tempDir.writeFile(
        `.viben/tasks/${TASK_NAME}/fix.jsonl`,
        '{"file": "src/fix.ts", "reason": "test"}\n'
      );

      const result = validateContext(tempDir.root, TASK_NAME);

      expect(result.success).toBe(true);
      expect(result.valid).toHaveLength(3);
      expect(result.valid).toContain("src/impl.ts");
      expect(result.valid).toContain("src/check.ts");
      expect(result.valid).toContain("src/fix.ts");
    });

    it("should validate directories", async () => {
      await tempDir.writeFile(
        `.viben/tasks/${TASK_NAME}/implement.jsonl`,
        '{"file": "src/existing-dir", "reason": "test", "type": "directory"}\n'
      );

      const result = validateContext(tempDir.root, TASK_NAME);

      expect(result.success).toBe(true);
      expect(result.valid).toContain("src/existing-dir");
    });

    it("should skip missing context files during validation", async () => {
      // Remove check and fix files
      const fs = await import("node:fs/promises");
      await fs.unlink(join(tempDir.root, `.viben/tasks/${TASK_NAME}/check.jsonl`));
      await fs.unlink(join(tempDir.root, `.viben/tasks/${TASK_NAME}/fix.jsonl`));

      await tempDir.writeFile(
        `.viben/tasks/${TASK_NAME}/implement.jsonl`,
        '{"file": "src/existing.ts", "reason": "test"}\n'
      );

      const result = validateContext(tempDir.root, TASK_NAME);

      expect(result.success).toBe(true);
      expect(result.valid).toContain("src/existing.ts");
    });
  });

  describe("end-to-end workflow", () => {
    it("should support full context lifecycle", async () => {
      // Create test files
      await tempDir.writeFile("src/main.ts", "// main");
      await tempDir.writeFile("src/utils.ts", "// utils");
      await tempDir.writeFile("src/helper.ts", "// helper");

      // 1. Initialize context
      const initResult = initContext(tempDir.root, TASK_NAME);
      expect(initResult.success).toBe(true);

      // 2. Add some files
      const addResult = addContext(tempDir.root, TASK_NAME, [
        "src/main.ts",
        "src/utils.ts",
        "src/helper.ts",
      ]);
      expect(addResult.success).toBe(true);
      expect(addResult.added).toBe(3);

      // 3. List context
      const listResult1 = listContext(tempDir.root, TASK_NAME);
      expect(listResult1.success).toBe(true);
      expect(listResult1.context["implement.jsonl"]).toHaveLength(3);

      // 4. Remove one file
      const removeResult = removeContext(tempDir.root, TASK_NAME, ["src/utils.ts"]);
      expect(removeResult.success).toBe(true);

      // 5. Verify removal
      const listResult2 = listContext(tempDir.root, TASK_NAME);
      expect(listResult2.context["implement.jsonl"]).toHaveLength(2);
      const remainingFiles = listResult2.context["implement.jsonl"].map((e) => e.file);
      expect(remainingFiles).toContain("src/main.ts");
      expect(remainingFiles).toContain("src/helper.ts");
      expect(remainingFiles).not.toContain("src/utils.ts");

      // 6. Validate context (all files still exist)
      const validateResult = validateContext(tempDir.root, TASK_NAME);
      expect(validateResult.success).toBe(true);
      expect(validateResult.valid).toHaveLength(2);
      expect(validateResult.missing).toHaveLength(0);
    });
  });
});

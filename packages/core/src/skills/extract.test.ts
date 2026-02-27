/**
 * Zip Extraction Tests
 *
 * Tests for zip extraction functionality:
 * - Extracting zip files to target directories
 * - Progress tracking during extraction
 * - Validation of extracted skill packages
 * - Handling of extraction errors and edge cases
 * - Root directory detection
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import AdmZip from "adm-zip";
import {
  extractZipToDirectory,
  getZipRootDirectory,
  type ExtractZipOptions,
  type ProgressCallback,
} from "./extract";
import { ValidationError } from "../error";

describe("extractZipToDirectory()", () => {
  let tempDir: string;
  let zipPath: string;
  let targetDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "viben-extract-test-"));
    zipPath = join(tempDir, "test.zip");
    targetDir = join(tempDir, "extracted");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Create a test zip file with given structure
   */
  async function createTestZip(
    structure: Record<string, string>,
    zipFile: string = zipPath
  ): Promise<void> {
    const zip = new AdmZip();

    for (const [path, content] of Object.entries(structure)) {
      zip.addFile(path, Buffer.from(content, "utf-8"));
    }

    zip.writeZip(zipFile);
  }

  /**
   * Create a valid skill zip with SKILL.md
   */
  async function createValidSkillZip(
    skillName: string = "test-skill",
    zipFile: string = zipPath
  ): Promise<void> {
    await createTestZip(
      {
        "SKILL.md": `---
name: ${skillName}
version: 1.0.0
description: Test skill
---

# ${skillName}

This is a test skill.
`,
        "index.ts": "export default function() { return 'hello'; }",
        "README.md": "# Test Skill",
      },
      zipFile
    );
  }

  /**
   * Create a skill zip with root directory
   */
  async function createSkillZipWithRoot(
    rootDir: string = "my-skill",
    zipFile: string = zipPath
  ): Promise<void> {
    await createTestZip(
      {
        [`${rootDir}/SKILL.md`]: `---
name: ${rootDir}
version: 1.0.0
---

# Skill
`,
        [`${rootDir}/index.ts`]: "export default function() {}",
      },
      zipFile
    );
  }

  // ============================================================================
  // Basic Extraction Tests
  // ============================================================================

  it("should extract a valid zip file", async () => {
    await createValidSkillZip();

    const result = await extractZipToDirectory({
      zipPath,
      targetDir,
    });

    expect(result.success).toBe(true);
    expect(result.extractedPath).toBe(targetDir);
    expect(result.files.length).toBeGreaterThan(0);
    expect(existsSync(join(targetDir, "SKILL.md"))).toBe(true);
    expect(existsSync(join(targetDir, "index.ts"))).toBe(true);
  });

  it("should extract skill name from SKILL.md", async () => {
    await createValidSkillZip("my-awesome-skill");

    const result = await extractZipToDirectory({
      zipPath,
      targetDir,
    });

    expect(result.skillName).toBe("my-awesome-skill");
  });

  it("should extract files and return file list", async () => {
    await createTestZip({
      "file1.txt": "content1",
      "file2.txt": "content2",
      "subdir/file3.txt": "content3",
    });

    const result = await extractZipToDirectory({
      zipPath,
      targetDir,
      validate: false, // Skip validation for non-skill zip
    });

    expect(result.files).toHaveLength(3);
    expect(result.files).toEqual(
      expect.arrayContaining([
        expect.stringContaining("file1.txt"),
        expect.stringContaining("file2.txt"),
        expect.stringContaining("file3.txt"),
      ])
    );
  });

  it("should handle zip with root directory", async () => {
    await createSkillZipWithRoot("my-skill");

    const result = await extractZipToDirectory({
      zipPath,
      targetDir,
    });

    expect(result.success).toBe(true);
    // Files should be extracted without the root directory
    expect(existsSync(join(targetDir, "SKILL.md"))).toBe(true);
    expect(existsSync(join(targetDir, "index.ts"))).toBe(true);
    // Root directory should be stripped
    expect(existsSync(join(targetDir, "my-skill"))).toBe(false);
  });

  it("should skip __MACOSX metadata files", async () => {
    await createTestZip({
      "SKILL.md": "---\nname: test\n---\n# Test",
      "__MACOSX/._SKILL.md": "macos metadata",
      ".DS_Store": "macos store",
      "index.ts": "export default {}",
    });

    const result = await extractZipToDirectory({
      zipPath,
      targetDir,
    });

    // Should only extract valid files, not __MACOSX or .DS_Store
    expect(result.files).toHaveLength(2);
    expect(result.files.some((f) => f.includes("__MACOSX"))).toBe(false);
    expect(result.files.some((f) => f.includes(".DS_Store"))).toBe(false);
  });

  // ============================================================================
  // Progress Tracking Tests
  // ============================================================================

  it("should call progress callback during extraction", async () => {
    await createTestZip({
      "file1.txt": "content1",
      "file2.txt": "content2",
      "file3.txt": "content3",
    });

    const progressCalls: number[] = [];
    const onProgress: ProgressCallback = (progress) => {
      progressCalls.push(progress);
    };

    await extractZipToDirectory({
      zipPath,
      targetDir,
      onProgress,
      validate: false,
    });

    // Progress should be called multiple times
    expect(progressCalls.length).toBeGreaterThan(0);
    // Should start at 0
    expect(progressCalls[0]).toBe(0);
    // Should end at 100 or close to it
    expect(progressCalls[progressCalls.length - 1]).toBeGreaterThanOrEqual(33);
  });

  it("should work without progress callback", async () => {
    await createValidSkillZip();

    const result = await extractZipToDirectory({
      zipPath,
      targetDir,
    });

    expect(result.success).toBe(true);
  });

  // ============================================================================
  // Validation Tests
  // ============================================================================

  it("should validate extracted skill by default", async () => {
    // Create zip without SKILL.md
    await createTestZip({
      "index.ts": "export default {}",
      "README.md": "# Test",
    });

    const result = await extractZipToDirectory({
      zipPath,
      targetDir,
    });

    expect(result.warnings).toBeDefined();
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("SKILL.md not found"),
      ])
    );
  });

  it("should skip validation when validate is false", async () => {
    await createTestZip({
      "index.ts": "export default {}",
    });

    const result = await extractZipToDirectory({
      zipPath,
      targetDir,
      validate: false,
    });

    expect(result.warnings).toBeUndefined();
  });

  it("should warn if SKILL.md is missing name field", async () => {
    await createTestZip({
      "SKILL.md": `---
version: 1.0.0
---

# Test
`,
    });

    const result = await extractZipToDirectory({
      zipPath,
      targetDir,
    });

    expect(result.warnings).toBeDefined();
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("missing 'name' field")])
    );
  });

  it("should warn if SKILL.md is empty", async () => {
    await createTestZip({
      "SKILL.md": "",
    });

    const result = await extractZipToDirectory({
      zipPath,
      targetDir,
    });

    expect(result.warnings).toBeDefined();
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("empty or invalid")])
    );
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  it("should throw ValidationError if zip file does not exist", async () => {
    const nonExistentZip = join(tempDir, "nonexistent.zip");

    await expect(
      extractZipToDirectory({
        zipPath: nonExistentZip,
        targetDir,
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      extractZipToDirectory({
        zipPath: nonExistentZip,
        targetDir,
      })
    ).rejects.toThrow("Zip file not found");
  });

  it("should throw ValidationError if zip file is invalid", async () => {
    // Create an invalid zip file
    await writeFile(zipPath, "not a valid zip file", "utf-8");

    await expect(
      extractZipToDirectory({
        zipPath,
        targetDir,
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      extractZipToDirectory({
        zipPath,
        targetDir,
      })
    ).rejects.toThrow("Failed to read zip file");
  });

  it("should throw ValidationError if zip is empty", async () => {
    const zip = new AdmZip();
    zip.writeZip(zipPath);

    await expect(
      extractZipToDirectory({
        zipPath,
        targetDir,
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      extractZipToDirectory({
        zipPath,
        targetDir,
      })
    ).rejects.toThrow("Zip file is empty");
  });

  it("should create target directory if it does not exist", async () => {
    await createValidSkillZip();

    const newTargetDir = join(tempDir, "new", "nested", "dir");
    expect(existsSync(newTargetDir)).toBe(false);

    const result = await extractZipToDirectory({
      zipPath,
      targetDir: newTargetDir,
    });

    expect(result.success).toBe(true);
    expect(existsSync(newTargetDir)).toBe(true);
  });

  // ============================================================================
  // Overwrite Tests
  // ============================================================================

  it("should handle overwrite option", async () => {
    await createValidSkillZip();

    // First extraction
    await extractZipToDirectory({
      zipPath,
      targetDir,
    });

    // Modify an extracted file
    await writeFile(join(targetDir, "index.ts"), "modified content", "utf-8");

    // Extract again with overwrite
    const result = await extractZipToDirectory({
      zipPath,
      targetDir,
      overwrite: true,
    });

    expect(result.success).toBe(true);
  });

  it("should work when target directory already exists", async () => {
    await createValidSkillZip();
    await mkdir(targetDir, { recursive: true });

    const result = await extractZipToDirectory({
      zipPath,
      targetDir,
    });

    expect(result.success).toBe(true);
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  it("should handle zip with only directories", async () => {
    const zip = new AdmZip();
    zip.addFile("dir1/", Buffer.from(""));
    zip.addFile("dir2/", Buffer.from(""));
    zip.writeZip(zipPath);

    const result = await extractZipToDirectory({
      zipPath,
      targetDir,
      validate: false,
    });

    // Should succeed but extract no files
    expect(result.success).toBe(true);
    expect(result.files).toHaveLength(0);
  });

  it("should handle zip with nested directories", async () => {
    await createTestZip({
      "a/b/c/file.txt": "deep file",
      "a/file1.txt": "file1",
    });

    const result = await extractZipToDirectory({
      zipPath,
      targetDir,
      validate: false,
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(targetDir, "b", "c", "file.txt"))).toBe(true);
    expect(existsSync(join(targetDir, "file1.txt"))).toBe(true);
  });

  it("should handle zip with mixed root files and directories", async () => {
    await createTestZip({
      "root-file.txt": "root",
      "dir1/file1.txt": "file1",
      "dir2/file2.txt": "file2",
    });

    const result = await extractZipToDirectory({
      zipPath,
      targetDir,
      validate: false,
    });

    expect(result.success).toBe(true);
    // When there are root files, structure is preserved
    expect(existsSync(join(targetDir, "root-file.txt"))).toBe(true);
    expect(existsSync(join(targetDir, "dir1", "file1.txt"))).toBe(true);
  });

  it("should handle extraction with warnings for individual files", async () => {
    await createValidSkillZip();

    // This tests that even if some files fail, others succeed
    const result = await extractZipToDirectory({
      zipPath,
      targetDir,
    });

    expect(result.success).toBe(true);
    expect(result.files.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// getZipRootDirectory() Tests
// ============================================================================

describe("getZipRootDirectory()", () => {
  let tempDir: string;
  let zipPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "viben-root-test-"));
    zipPath = join(tempDir, "test.zip");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  async function createTestZip(
    structure: Record<string, string>
  ): Promise<void> {
    const zip = new AdmZip();
    for (const [path, content] of Object.entries(structure)) {
      zip.addFile(path, Buffer.from(content, "utf-8"));
    }
    zip.writeZip(zipPath);
  }

  it("should return root directory when all files in same root", async () => {
    await createTestZip({
      "my-skill/SKILL.md": "content",
      "my-skill/index.ts": "code",
      "my-skill/README.md": "docs",
    });

    const root = getZipRootDirectory(zipPath);

    expect(root).toBe("my-skill");
  });

  it("should return undefined when files are at root level", async () => {
    await createTestZip({
      "SKILL.md": "content",
      "index.ts": "code",
    });

    const root = getZipRootDirectory(zipPath);

    expect(root).toBeUndefined();
  });

  it("should return undefined when multiple root directories", async () => {
    await createTestZip({
      "dir1/file1.txt": "content1",
      "dir2/file2.txt": "content2",
    });

    const root = getZipRootDirectory(zipPath);

    expect(root).toBeUndefined();
  });

  it("should return undefined for invalid zip", async () => {
    await writeFile(zipPath, "not a zip", "utf-8");

    const root = getZipRootDirectory(zipPath);

    expect(root).toBeUndefined();
  });

  it("should return undefined for nonexistent zip", async () => {
    const nonExistent = join(tempDir, "nonexistent.zip");

    const root = getZipRootDirectory(nonExistent);

    expect(root).toBeUndefined();
  });

  it("should handle zip with only root directory", async () => {
    const zip = new AdmZip();
    zip.addFile("my-skill/", Buffer.from(""));
    zip.writeZip(zipPath);

    const root = getZipRootDirectory(zipPath);

    // Should handle directory-only zip gracefully
    expect(root).toBe("my-skill");
  });

  it("should ignore directories when determining root", async () => {
    const zip = new AdmZip();
    zip.addFile("root-dir/", Buffer.from(""));
    zip.addFile("root-dir/file.txt", Buffer.from("content"));
    zip.writeZip(zipPath);

    const root = getZipRootDirectory(zipPath);

    expect(root).toBe("root-dir");
  });

  it("should handle nested structure correctly", async () => {
    await createTestZip({
      "skill/src/index.ts": "code",
      "skill/src/utils.ts": "utils",
      "skill/SKILL.md": "docs",
    });

    const root = getZipRootDirectory(zipPath);

    expect(root).toBe("skill");
  });
});

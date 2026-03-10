/**
 * Tests for IndexBuilder
 */

import * as fs from "fs";
import * as path from "path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { IndexBuilder } from "./builder";

describe("IndexBuilder", () => {
  const testProjectDir = path.join(__dirname, "__fixtures__", "test-project");
  const testOutputDir = path.join(__dirname, "__fixtures__", "test-output");

  beforeEach(() => {
    // Create test project structure
    fs.mkdirSync(testProjectDir, { recursive: true });
    fs.mkdirSync(path.join(testProjectDir, "packages", "core", "src"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(testProjectDir, "apps", "web"), { recursive: true });
    fs.mkdirSync(path.join(testProjectDir, "docs", "specs"), {
      recursive: true,
    });

    // Create package.json
    fs.writeFileSync(
      path.join(testProjectDir, "package.json"),
      JSON.stringify({
        name: "test-project",
        dependencies: { react: "^18.0.0" },
        devDependencies: { typescript: "^5.0.0" },
      })
    );

    // Create a package
    fs.writeFileSync(
      path.join(testProjectDir, "packages", "core", "package.json"),
      JSON.stringify({
        name: "@test/core",
        description: "Test core package",
      })
    );

    // Create entry file
    fs.writeFileSync(
      path.join(testProjectDir, "packages", "core", "src", "index.ts"),
      `/**
 * Test core module
 */
export function testFunction() {}
export const testConst = 42;
`
    );

    // Create app
    fs.writeFileSync(
      path.join(testProjectDir, "apps", "web", "package.json"),
      JSON.stringify({
        name: "test-web",
        dependencies: { next: "^14.0.0" },
      })
    );

    // Create doc
    fs.writeFileSync(
      path.join(testProjectDir, "docs", "specs", "test-spec.md"),
      `# Test Specification

This is a test document.

## Section 1

Content here.
`
    );
  });

  afterEach(() => {
    // Cleanup
    fs.rmSync(testProjectDir, { recursive: true, force: true });
    fs.rmSync(testOutputDir, { recursive: true, force: true });
  });

  it("should generate all three index files", async () => {
    const builder = new IndexBuilder({
      projectDir: testProjectDir,
      outputDir: testOutputDir,
      enableAI: false,
      verbose: false,
    });

    const result = await builder.generate();

    expect(result.success).toBe(true);
    expect(result.files).toHaveLength(3);
    expect(fs.existsSync(path.join(testOutputDir, "overview.md"))).toBe(true);
    expect(fs.existsSync(path.join(testOutputDir, "code-index.md"))).toBe(true);
    expect(fs.existsSync(path.join(testOutputDir, "docs-index.md"))).toBe(true);
  });

  it("should detect tech stack correctly", async () => {
    const builder = new IndexBuilder({
      projectDir: testProjectDir,
      outputDir: testOutputDir,
      enableAI: false,
      verbose: false,
    });

    await builder.generate();

    const overview = fs.readFileSync(
      path.join(testOutputDir, "overview.md"),
      "utf-8"
    );

    expect(overview).toContain("TypeScript");
  });

  it("should index packages", async () => {
    const builder = new IndexBuilder({
      projectDir: testProjectDir,
      outputDir: testOutputDir,
      enableAI: false,
      verbose: false,
    });

    await builder.generate();

    const codeIndex = fs.readFileSync(
      path.join(testOutputDir, "code-index.md"),
      "utf-8"
    );

    expect(codeIndex).toContain("@test/core");
    expect(codeIndex).toContain("Test core package");
  });

  it("should index documentation", async () => {
    const builder = new IndexBuilder({
      projectDir: testProjectDir,
      outputDir: testOutputDir,
      enableAI: false,
      verbose: false,
    });

    await builder.generate();

    const docsIndex = fs.readFileSync(
      path.join(testOutputDir, "docs-index.md"),
      "utf-8"
    );

    expect(docsIndex).toContain("test-spec.md");
    // Description is extracted from first paragraph after title
    expect(docsIndex).toContain("This is a test document");
  });

  it("should work with empty docs directory", async () => {
    // Remove docs
    fs.rmSync(path.join(testProjectDir, "docs"), { recursive: true });

    const builder = new IndexBuilder({
      projectDir: testProjectDir,
      outputDir: testOutputDir,
      enableAI: false,
      verbose: false,
    });

    const result = await builder.generate();

    expect(result.success).toBe(true);

    const docsIndex = fs.readFileSync(
      path.join(testOutputDir, "docs-index.md"),
      "utf-8"
    );

    expect(docsIndex).toContain("共 0 篇文档");
  });

  it("should handle custom output directory", async () => {
    const customOutput = path.join(testProjectDir, "custom-index");

    const builder = new IndexBuilder({
      projectDir: testProjectDir,
      outputDir: customOutput,
      enableAI: false,
      verbose: false,
    });

    const result = await builder.generate();

    expect(result.success).toBe(true);
    expect(result.outputDir).toBe(customOutput);
    expect(fs.existsSync(path.join(customOutput, "overview.md"))).toBe(true);
  });
});

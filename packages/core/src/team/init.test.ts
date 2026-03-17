import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initTeam } from "./init";

describe("initTeam", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `viben-test-${Date.now()}`);
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  it("should create .viben directory structure", async () => {
    const result = await initTeam({
      targetDir: testDir,
      developerName: "test-dev",
      projectType: "fullstack",
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(testDir, ".viben"))).toBe(true);
    expect(existsSync(join(testDir, ".viben/workflow.md"))).toBe(true);
    expect(existsSync(join(testDir, ".viben/worktree.yaml"))).toBe(true);
    expect(existsSync(join(testDir, ".viben/.gitignore"))).toBe(true);
    expect(existsSync(join(testDir, ".viben/.developer"))).toBe(true);
  });

  it("should create .claude directory structure", async () => {
    const result = await initTeam({
      targetDir: testDir,
      developerName: "test-dev",
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(testDir, ".claude/settings.json"))).toBe(true);
    expect(existsSync(join(testDir, ".claude/agents/check.md"))).toBe(true);
    expect(existsSync(join(testDir, ".claude/agents/implement.md"))).toBe(true);
    expect(existsSync(join(testDir, ".claude/commands/viben/start.md"))).toBe(true);
    expect(existsSync(join(testDir, ".claude/hooks/session-start.py"))).toBe(true);
  });

  it("should create .cursor directory when CURSOR executor is included", async () => {
    const result = await initTeam({
      targetDir: testDir,
      developerName: "test-dev",
      executors: ["CURSOR", "CLAUDE_CODE"],
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(testDir, ".cursor/commands/viben-start.md"))).toBe(true);
  });

  it("should not create .cursor directory when CURSOR executor is not included", async () => {
    const result = await initTeam({
      targetDir: testDir,
      developerName: "test-dev",
      executors: ["CLAUDE_CODE"],
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(testDir, ".cursor"))).toBe(false);
  });

  it("should create AGENTS.md in root", async () => {
    const result = await initTeam({
      targetDir: testDir,
      developerName: "test-dev",
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(testDir, "AGENTS.md"))).toBe(true);
  });

  it("should create developer workspace", async () => {
    const result = await initTeam({
      targetDir: testDir,
      developerName: "my-agent",
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(testDir, ".viben/workspace/my-agent/index.md"))).toBe(true);
    expect(existsSync(join(testDir, ".viben/workspace/my-agent/journal-1.md"))).toBe(true);
  });

  it("should create bootstrap task", async () => {
    const result = await initTeam({
      targetDir: testDir,
      developerName: "test-dev",
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(testDir, ".viben/tasks/00-bootstrap-guidelines/task.json"))).toBe(true);
    expect(existsSync(join(testDir, ".viben/tasks/00-bootstrap-guidelines/prd.md"))).toBe(true);
    expect(existsSync(join(testDir, ".viben/.current-task"))).toBe(true);
  });

  it("should validate developer name format", async () => {
    // Valid names
    await expect(initTeam({ targetDir: testDir, developerName: "john" })).resolves.toBeDefined();
    rmSync(testDir, { recursive: true });

    await expect(initTeam({ targetDir: testDir, developerName: "john-doe" })).resolves.toBeDefined();
    rmSync(testDir, { recursive: true });

    await expect(initTeam({ targetDir: testDir, developerName: "test123" })).resolves.toBeDefined();
    rmSync(testDir, { recursive: true });

    // Invalid names
    await expect(initTeam({ targetDir: testDir, developerName: "" })).rejects.toThrow();
    await expect(initTeam({ targetDir: testDir, developerName: "-invalid" })).rejects.toThrow();
    await expect(initTeam({ targetDir: testDir, developerName: "invalid-" })).rejects.toThrow();
    await expect(initTeam({ targetDir: testDir, developerName: "UPPERCASE" })).rejects.toThrow();
  });

  it("should throw error if directory exists without force option", async () => {
    await initTeam({
      targetDir: testDir,
      developerName: "test-dev",
    });

    await expect(
      initTeam({
        targetDir: testDir,
        developerName: "test-dev",
        force: false,
      })
    ).rejects.toThrow(/already exists/);
  });

  it("should overwrite with force option", async () => {
    await initTeam({
      targetDir: testDir,
      developerName: "first-dev",
    });

    const result = await initTeam({
      targetDir: testDir,
      developerName: "second-dev",
      force: true,
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(testDir, ".viben/workspace/second-dev/index.md"))).toBe(true);
  });

  it("should create backend specs for backend project type", async () => {
    await initTeam({
      targetDir: testDir,
      developerName: "test-dev",
      projectType: "backend",
    });

    expect(existsSync(join(testDir, "docs/specs/backend/index.md"))).toBe(true);
    expect(existsSync(join(testDir, "docs/specs/backend/database-guidelines.md"))).toBe(true);
    expect(existsSync(join(testDir, "docs/specs/frontend/index.md"))).toBe(false);
  });

  it("should create frontend specs for frontend project type", async () => {
    await initTeam({
      targetDir: testDir,
      developerName: "test-dev",
      projectType: "frontend",
    });

    expect(existsSync(join(testDir, "docs/specs/frontend/index.md"))).toBe(true);
    expect(existsSync(join(testDir, "docs/specs/frontend/component-guidelines.md"))).toBe(true);
    expect(existsSync(join(testDir, "docs/specs/backend/index.md"))).toBe(false);
  });

  it("should create both frontend and backend specs for fullstack project type", async () => {
    await initTeam({
      targetDir: testDir,
      developerName: "test-dev",
      projectType: "fullstack",
    });

    expect(existsSync(join(testDir, "docs/specs/frontend/index.md"))).toBe(true);
    expect(existsSync(join(testDir, "docs/specs/backend/index.md"))).toBe(true);
    expect(existsSync(join(testDir, "docs/specs/guides/index.md"))).toBe(true);
  });

  it("should return list of created files", async () => {
    const result = await initTeam({
      targetDir: testDir,
      developerName: "test-dev",
      projectType: "fullstack",
      executors: ["CURSOR", "CLAUDE_CODE"],
    });

    expect(result.files.length).toBeGreaterThan(50);
    expect(result.files).toContain(".viben/workflow.md");
    expect(result.files).toContain(".claude/settings.json");
    expect(result.files).toContain("AGENTS.md");
  });

  it("should create .template-hashes.json with SHA256 hashes", async () => {
    await initTeam({
      targetDir: testDir,
      developerName: "test-dev",
    });

    const hashesPath = join(testDir, ".viben/.template-hashes.json");
    expect(existsSync(hashesPath)).toBe(true);

    const hashes = JSON.parse(readFileSync(hashesPath, "utf-8"));
    expect(hashes[".viben/workflow.md"]).toBeDefined();
    expect(hashes[".claude/settings.json"]).toBeDefined();
    // SHA256 hash is 64 characters
    expect(hashes[".viben/workflow.md"]).toHaveLength(64);
  });

  it("should skip existing files with skipExisting option", async () => {
    // First init
    await initTeam({
      targetDir: testDir,
      developerName: "first-dev",
    });

    // Modify a file to verify it's not overwritten
    const workflowPath = join(testDir, ".viben/workflow.md");
    const originalContent = readFileSync(workflowPath, "utf-8");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(workflowPath, "MODIFIED CONTENT");

    // Second init with skipExisting
    const result = await initTeam({
      targetDir: testDir,
      developerName: "second-dev",
      skipExisting: true,
    });

    expect(result.success).toBe(true);
    // Original file should not be overwritten
    const afterContent = readFileSync(workflowPath, "utf-8");
    expect(afterContent).toBe("MODIFIED CONTENT");
    // New developer workspace should be created
    expect(existsSync(join(testDir, ".viben/workspace/second-dev/index.md"))).toBe(true);
  });

  it("should create .developer file with name and initialized_at", async () => {
    const beforeInit = new Date();

    await initTeam({
      targetDir: testDir,
      developerName: "test-dev",
    });

    const afterInit = new Date();

    const developerPath = join(testDir, ".viben/.developer");
    expect(existsSync(developerPath)).toBe(true);

    const content = readFileSync(developerPath, "utf-8");
    expect(content).toContain("name=test-dev");
    expect(content).toContain("initialized_at=");

    // Parse and validate timestamp
    const match = content.match(/initialized_at=(.+)/);
    expect(match).not.toBeNull();
    const timestamp = new Date(match![1]);
    expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeInit.getTime());
    expect(timestamp.getTime()).toBeLessThanOrEqual(afterInit.getTime());
  });

  it("should always create guides directory regardless of project type", async () => {
    // Test frontend type
    await initTeam({
      targetDir: testDir,
      developerName: "test-dev",
      projectType: "frontend",
    });
    expect(existsSync(join(testDir, "docs/specs/guides/index.md"))).toBe(true);
    expect(existsSync(join(testDir, "docs/specs/guides/cross-layer-thinking-guide.md"))).toBe(true);
    expect(existsSync(join(testDir, "docs/specs/guides/code-reuse-thinking-guide.md"))).toBe(true);
    rmSync(testDir, { recursive: true });

    // Test backend type
    await initTeam({
      targetDir: testDir,
      developerName: "test-dev",
      projectType: "backend",
    });
    expect(existsSync(join(testDir, "docs/specs/guides/index.md"))).toBe(true);
    expect(existsSync(join(testDir, "docs/specs/guides/cross-layer-thinking-guide.md"))).toBe(true);
    expect(existsSync(join(testDir, "docs/specs/guides/code-reuse-thinking-guide.md"))).toBe(true);
  });

  it("should return warnings array in result", async () => {
    const result = await initTeam({
      targetDir: testDir,
      developerName: "test-dev",
    });

    expect(result.success).toBe(true);
    // warnings should be undefined when there are no warnings
    expect(result.warnings).toBeUndefined();
  });

  it("should validate error messages for invalid developer names", async () => {
    // Empty name
    await expect(initTeam({ targetDir: testDir, developerName: "" })).rejects.toThrow(
      "Developer name is required"
    );

    // Starting with hyphen
    await expect(initTeam({ targetDir: testDir, developerName: "-invalid" })).rejects.toThrow(
      /Invalid developer name/
    );

    // Ending with hyphen
    await expect(initTeam({ targetDir: testDir, developerName: "invalid-" })).rejects.toThrow(
      /Invalid developer name/
    );

    // Uppercase letters
    await expect(initTeam({ targetDir: testDir, developerName: "UPPERCASE" })).rejects.toThrow(
      /Invalid developer name/
    );

    // Special characters
    await expect(initTeam({ targetDir: testDir, developerName: "test_dev" })).rejects.toThrow(
      /Invalid developer name/
    );

    // Spaces
    await expect(initTeam({ targetDir: testDir, developerName: "test dev" })).rejects.toThrow(
      /Invalid developer name/
    );
  });

  it("should create bootstrap task with correct task.json content", async () => {
    await initTeam({
      targetDir: testDir,
      developerName: "test-dev",
      projectType: "frontend",
    });

    const taskJsonPath = join(testDir, ".viben/tasks/00-bootstrap-guidelines/task.json");
    const taskJson = JSON.parse(readFileSync(taskJsonPath, "utf-8"));

    expect(taskJson.name).toBe("Bootstrap Guidelines");
    expect(taskJson.id).toBe("00-bootstrap-guidelines");
    expect(taskJson.status).toBe("in_progress");
    expect(taskJson.priority).toBe("high");
    expect(taskJson.assignee).toBe("test-dev");
    expect(taskJson.createdAt).toBeDefined();
  });

  it("should set .current-task to bootstrap task path", async () => {
    await initTeam({
      targetDir: testDir,
      developerName: "test-dev",
    });

    const currentTaskPath = join(testDir, ".viben/.current-task");
    const currentTask = readFileSync(currentTaskPath, "utf-8");

    expect(currentTask).toBe(".viben/tasks/00-bootstrap-guidelines");
  });

  it("should create hooks with executable permissions", async () => {
    await initTeam({
      targetDir: testDir,
      developerName: "test-dev",
    });

    const hookPath = join(testDir, ".claude/hooks/session-start.py");
    expect(existsSync(hookPath)).toBe(true);

    // Check executable permission (Unix only)
    if (process.platform !== "win32") {
      const stat = statSync(hookPath);
      const isExecutable = (stat.mode & 0o111) !== 0;
      expect(isExecutable).toBe(true);
    }
  });

  it("should create .version file with correct version", async () => {
    await initTeam({
      targetDir: testDir,
      developerName: "test-dev",
    });

    const versionPath = join(testDir, ".viben/.version");
    expect(existsSync(versionPath)).toBe(true);

    const version = readFileSync(versionPath, "utf-8");
    expect(version).toBe("1.0.0");
  });

  it("should default to fullstack when projectType is not provided", async () => {
    const result = await initTeam({
      targetDir: testDir,
      developerName: "test-dev",
      // projectType not specified
    });

    expect(result.success).toBe(true);
    // Should have both frontend and backend specs
    expect(existsSync(join(testDir, "docs/specs/frontend/index.md"))).toBe(true);
    expect(existsSync(join(testDir, "docs/specs/backend/index.md"))).toBe(true);
  });
});

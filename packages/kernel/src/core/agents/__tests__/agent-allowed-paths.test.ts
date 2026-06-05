import { describe, it, expect, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { PathGuard } from "../../security/path-guard.js";

/**
 * Tests that PathGuard correctly handles paths from workspace.security.allowedPaths config.
 *
 * AgentInstance.spawnSubprocess() now accepts extraAllowedPaths so the config-level
 * whitelist is passed through to the PathGuard at spawn time — before any subsequent
 * addAllowedPath() calls from SessionFactory.
 *
 * We test PathGuard directly since AgentInstance requires a real subprocess.
 */
describe("PathGuard with config-level allowedPaths", () => {
  let tmpDir: string;
  let workspaceDir: string;
  let configAllowedDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-allowed-"));
    workspaceDir = path.join(tmpDir, "workspace");
    configAllowedDir = path.join(tmpDir, "shared-assets");
    fs.mkdirSync(workspaceDir, { recursive: true });
    fs.mkdirSync(configAllowedDir, { recursive: true });
    fs.writeFileSync(path.join(workspaceDir, "app.ts"), "const x = 1;");
    fs.writeFileSync(path.join(configAllowedDir, "logo.png"), "png-data");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("allows reading from workspace cwd", () => {
    const guard = new PathGuard({
      cwd: workspaceDir,
      allowedPaths: [],
      ignorePatterns: [],
    });
    const result = guard.validatePath(path.join(workspaceDir, "app.ts"), "read");
    expect(result.allowed).toBe(true);
  });

  it("blocks reading from external dir without allowedPaths", () => {
    const guard = new PathGuard({
      cwd: workspaceDir,
      allowedPaths: [],
      ignorePatterns: [],
    });
    const result = guard.validatePath(path.join(configAllowedDir, "logo.png"), "read");
    expect(result.allowed).toBe(false);
  });

  it("allows reading from external dir when listed in allowedPaths", () => {
    const guard = new PathGuard({
      cwd: workspaceDir,
      allowedPaths: [configAllowedDir],
      ignorePatterns: [],
    });
    const result = guard.validatePath(path.join(configAllowedDir, "logo.png"), "read");
    expect(result.allowed).toBe(true);
  });

  it("addAllowedPath() after construction also grants access", () => {
    const guard = new PathGuard({
      cwd: workspaceDir,
      allowedPaths: [],
      ignorePatterns: [],
    });
    guard.addAllowedPath(configAllowedDir);
    const result = guard.validatePath(path.join(configAllowedDir, "logo.png"), "read");
    expect(result.allowed).toBe(true);
  });
});

import { beforeEach, afterEach } from "vitest";

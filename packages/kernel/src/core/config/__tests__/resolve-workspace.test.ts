import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConfigManager } from "../config.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

/**
 * Tests for ConfigManager.resolveWorkspace() focusing on:
 * - Deriving workspace base from configPath (parent of .viben/)
 * - allowExternalWorkspaces flag behavior
 * - External absolute paths (outside workspace base)
 * - Named workspace paths (relative)
 * - Tilde paths inside/outside workspace base
 */
describe("ConfigManager.resolveWorkspace", () => {
  let tmpDir: string;
  let instanceRoot: string;
  let configPath: string;
  let externalDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "viben-cfg-test-"));
    // Simulate instance: tmpDir/instance/.viben/config.json → workspace = tmpDir/instance/
    instanceRoot = path.join(tmpDir, "instance");
    const dotViben = path.join(instanceRoot, ".viben");
    fs.mkdirSync(dotViben, { recursive: true });
    configPath = path.join(dotViben, "config.json");
    // External dir is a sibling, NOT under instanceRoot
    externalDir = path.join(tmpDir, "external-project");
    fs.mkdirSync(externalDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeManager(allowExternalWorkspaces: boolean): ConfigManager {
    const config = {
      defaultAgent: "claude",
      workspace: {
        allowExternalWorkspaces,
      },
    };
    fs.writeFileSync(configPath, JSON.stringify(config));
    const mgr = new ConfigManager(configPath);
    // Bypass load() — directly inject config for unit testing
    (mgr as any).config = {
      defaultAgent: "claude",
      workspace: {
        allowExternalWorkspaces,
        security: { allowedPaths: [], envWhitelist: [] },
      },
      logging: {
        level: "info",
        logDir: "~/.viben/logs",
        maxFileSize: "10m",
        maxFiles: 7,
        sessionLogRetentionDays: 30,
      },
      runMode: "foreground",
      autoStart: false,
      sessionStore: { ttlDays: 30 },
      integrations: {},
      agentSwitch: { labelHistory: true },
    };
    return mgr;
  }

  describe("workspace base derived from configPath", () => {
    it("returns parent of .viben/ when no input given", () => {
      const mgr = makeManager(true);
      const result = mgr.resolveWorkspace();
      expect(result).toBe(instanceRoot);
    });

    it("resolves named workspace under instance root", () => {
      const mgr = makeManager(true);
      const result = mgr.resolveWorkspace("my-project");
      expect(result).toBe(path.join(instanceRoot, "my-project"));
    });
  });

  describe("allowExternalWorkspaces: true (default)", () => {
    it("allows absolute path inside workspace base", () => {
      const mgr = makeManager(true);
      const subDir = path.join(instanceRoot, "my-project");
      fs.mkdirSync(subDir, { recursive: true });
      expect(mgr.resolveWorkspace(subDir)).toBe(subDir);
    });

    it("allows absolute path outside workspace base", () => {
      const mgr = makeManager(true);
      const result = mgr.resolveWorkspace(externalDir);
      expect(result).toBe(externalDir);
    });

    it("throws when external absolute path does not exist", () => {
      const mgr = makeManager(true);
      const nonExistent = path.join(tmpDir, "does-not-exist");
      expect(() => mgr.resolveWorkspace(nonExistent)).toThrow(/does not exist/);
    });

    it("allows workspace base itself as absolute path", () => {
      const mgr = makeManager(true);
      expect(mgr.resolveWorkspace(instanceRoot)).toBe(instanceRoot);
    });
  });

  describe("allowExternalWorkspaces: false", () => {
    it("allows absolute path inside workspace base", () => {
      const mgr = makeManager(false);
      const subDir = path.join(instanceRoot, "my-project");
      fs.mkdirSync(subDir, { recursive: true });
      expect(mgr.resolveWorkspace(subDir)).toBe(subDir);
    });

    it("throws when absolute path is outside workspace base", () => {
      const mgr = makeManager(false);
      expect(() => mgr.resolveWorkspace(externalDir)).toThrow(
        /outside base directory/,
      );
    });

    it("throws when tilde path is outside workspace base", () => {
      const mgr = makeManager(false);
      // Use a home-relative path that isn't under instanceRoot
      expect(() => mgr.resolveWorkspace("~/some-other-project")).toThrow(
        /outside base directory/,
      );
    });
  });

  describe("named workspaces", () => {
    it("rejects names with special characters", () => {
      const mgr = makeManager(true);
      expect(() => mgr.resolveWorkspace("my project")).toThrow(
        /Invalid workspace name/,
      );
    });

    it("rejects names with path separators", () => {
      const mgr = makeManager(true);
      expect(() => mgr.resolveWorkspace("my/project")).toThrow(
        /Invalid workspace name/,
      );
    });

    it("converts name to lowercase", () => {
      const mgr = makeManager(true);
      const result = mgr.resolveWorkspace("MyProject");
      expect(result).toBe(path.join(instanceRoot, "myproject"));
    });
  });
});

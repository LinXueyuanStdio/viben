import { describe, it, expect, vi, afterEach } from "vitest";
import {
  resolveDistribution,
  getPlatformKey,
  buildInstalledAgent,
} from "../agent-installer.js";
import type { RegistryAgent } from "../../types.js";

describe("agent-installer", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  describe("getPlatformKey", () => {
    it("returns correct key for darwin arm64", () => {
      vi.stubGlobal("process", { ...process, platform: "darwin", arch: "arm64" });
      expect(getPlatformKey()).toBe("darwin-aarch64");
    });

    it("returns correct key for linux x64", () => {
      vi.stubGlobal("process", { ...process, platform: "linux", arch: "x64" });
      expect(getPlatformKey()).toBe("linux-x86_64");
    });
  });

  describe("resolveDistribution", () => {
    it("prefers npx when available", () => {
      const agent: RegistryAgent = {
        id: "test", name: "Test", version: "1.0.0", description: "test",
        distribution: {
          npx: { package: "test@1.0.0", args: ["--acp"] },
          binary: { "darwin-aarch64": { archive: "https://example.com/test.tar.gz", cmd: "./test" } },
        },
      };
      const result = resolveDistribution(agent);
      expect(result?.type).toBe("npx");
    });

    it("falls back to binary when no npx/uvx", () => {
      const agent: RegistryAgent = {
        id: "test", name: "Test", version: "1.0.0", description: "test",
        distribution: {
          binary: { "darwin-aarch64": { archive: "https://example.com/test.tar.gz", cmd: "./test" } },
        },
      };
      const result = resolveDistribution(agent);
      expect(result?.type).toBe("binary");
    });

    it("returns null when no matching platform for binary", () => {
      const agent: RegistryAgent = {
        id: "test", name: "Test", version: "1.0.0", description: "test",
        distribution: {
          binary: { "windows-x86_64": { archive: "https://example.com/test.zip", cmd: "./test.exe" } },
        },
      };
      // On non-windows, this should return null
      if (process.platform !== "win32") {
        const result = resolveDistribution(agent);
        expect(result).toBeNull();
      }
    });
  });

  describe("buildInstalledAgent", () => {
    it("builds npx agent correctly", () => {
      const result = buildInstalledAgent(
        "claude-acp", "Claude Agent", "0.22.2",
        { type: "npx", package: "@agentclientprotocol/claude-agent-acp@0.22.2", args: [] },
      );
      expect(result.command).toBe("npx");
      expect(result.args).toEqual(["@agentclientprotocol/claude-agent-acp"]);
      expect(result.distribution).toBe("npx");
    });

    it("builds uvx agent correctly", () => {
      const result = buildInstalledAgent(
        "crow-cli", "crow-cli", "0.1.14",
        { type: "uvx", package: "crow-cli", args: ["acp"] },
      );
      expect(result.command).toBe("uvx");
      expect(result.args).toEqual(["crow-cli", "acp"]);
      expect(result.distribution).toBe("uvx");
    });

    it("builds binary agent with absolute path", () => {
      const result = buildInstalledAgent(
        "cursor", "Cursor", "0.1.0",
        { type: "binary", archive: "https://example.com/cursor.tar.gz", cmd: "./cursor-agent", args: ["acp"] },
        "/home/user/.viben/agents/cursor",
      );
      expect(result.distribution).toBe("binary");
      expect(result.binaryPath).toBe("/home/user/.viben/agents/cursor");
      expect(result.args).toEqual(["acp"]);
    });
  });
});

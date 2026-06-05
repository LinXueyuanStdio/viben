import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Agent Installer Security", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "installer-sec-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("download size limit", () => {
    it("rejects downloads exceeding MAX_DOWNLOAD_SIZE", async () => {
      const { readResponseWithProgress, MAX_DOWNLOAD_SIZE } = await import("../agent-installer.js");
      const largeChunk = new Uint8Array(MAX_DOWNLOAD_SIZE + 1);
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: largeChunk })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };
      const mockResponse = {
        body: { getReader: () => mockReader },
      } as unknown as Response;

      await expect(
        readResponseWithProgress(mockResponse, 0),
      ).rejects.toThrow(/size limit/i);
    });
  });

  describe("tar content validation", () => {
    it("rejects archive entries containing ../", async () => {
      const { validateTarContents } = await import("../agent-installer.js");
      const entries = ["bin/agent", "../../../etc/passwd"];
      expect(() => validateTarContents(entries, tmpDir)).toThrow(/unsafe/i);
    });

    it("rejects absolute path entries", async () => {
      const { validateTarContents } = await import("../agent-installer.js");
      const entries = ["/etc/passwd"];
      expect(() => validateTarContents(entries, tmpDir)).toThrow(/unsafe/i);
    });

    it("allows normal entries", async () => {
      const { validateTarContents } = await import("../agent-installer.js");
      const entries = ["bin/agent", "lib/libfoo.so", "README.md"];
      expect(() => validateTarContents(entries, tmpDir)).not.toThrow();
    });
  });

  describe("checksum verification", () => {
    it("rejects buffer with mismatched SHA-256", async () => {
      const { verifyChecksum } = await import("../agent-installer.js");
      const buffer = Buffer.from("hello world");
      expect(() =>
        verifyChecksum(buffer, "0000000000000000000000000000000000000000000000000000000000000000"),
      ).toThrow(/integrity/i);
    });

    it("accepts buffer with matching SHA-256", async () => {
      const crypto = await import("node:crypto");
      const { verifyChecksum } = await import("../agent-installer.js");
      const buffer = Buffer.from("hello world");
      const hash = crypto.createHash("sha256").update(buffer).digest("hex");
      expect(() => verifyChecksum(buffer, hash)).not.toThrow();
    });
  });

  describe("uninstall path validation", () => {
    it("rejects binaryPath outside agents directory", async () => {
      const { validateUninstallPath } = await import("../agent-installer.js");
      expect(() =>
        validateUninstallPath("/etc/important", tmpDir),
      ).toThrow(/outside/i);
    });

    it("allows binaryPath within agents directory", async () => {
      const { validateUninstallPath } = await import("../agent-installer.js");
      const agentPath = path.join(tmpDir, "my-agent");
      fs.mkdirSync(agentPath, { recursive: true });
      expect(() => validateUninstallPath(agentPath, tmpDir)).not.toThrow();
    });
  });
});

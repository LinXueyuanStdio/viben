import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionManager } from "../session-manager";
import type { JupyterClient } from "../jupyter-client";

describe("SessionManager", () => {
  let baseDir: string;
  let manager: SessionManager;
  let mockClient: JupyterClient;

  beforeEach(async () => {
    baseDir = await mkdtemp(join(tmpdir(), "session-manager-test-"));
    manager = new SessionManager(baseDir);
    mockClient = {
      createKernel: vi.fn().mockResolvedValue("new-kernel-id"),
      getKernelStatus: vi.fn().mockResolvedValue("alive"),
    } as unknown as JupyterClient;
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  describe("getActiveKernel", () => {
    it("should create a new kernel and jsonl file when session has no history", async () => {
      const kernelId = await manager.getActiveKernel("session-1", mockClient);

      expect(kernelId).toBe("new-kernel-id");
      expect(mockClient.createKernel).toHaveBeenCalledOnce();

      const sessionDir = join(baseDir, "session-1");
      const files = await readdir(sessionDir);
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/^\d+-new-kernel-id\.jsonl$/);
    });

    it("should reuse existing kernel when alive", async () => {
      await manager.getActiveKernel("session-1", mockClient);
      const kernelId = await manager.getActiveKernel("session-1", mockClient);

      expect(kernelId).toBe("new-kernel-id");
      expect(mockClient.createKernel).toHaveBeenCalledOnce();
    });

    it("should create new kernel when existing is dead", async () => {
      await manager.getActiveKernel("session-1", mockClient);

      (mockClient.getKernelStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce("dead");
      (mockClient.createKernel as ReturnType<typeof vi.fn>).mockResolvedValueOnce("replacement-kernel");

      manager.clearCache("session-1");
      const kernelId = await manager.getActiveKernel("session-1", mockClient);

      expect(kernelId).toBe("replacement-kernel");

      const files = await readdir(join(baseDir, "session-1"));
      expect(files).toHaveLength(2);
    });
  });

  describe("recordCode / recordResult", () => {
    it("should append code and result entries to jsonl", async () => {
      await manager.getActiveKernel("session-1", mockClient);

      const codeId = await manager.recordCode("session-1", "new-kernel-id", {
        code: "print('hello')",
        description: "test",
      });
      expect(codeId).toBe("c_001");

      await manager.recordResult("session-1", "new-kernel-id", codeId, {
        status: "ok",
        outputs: [{ type: "stream", stream_name: "stdout", text: "hello\n" }],
      });

      const files = await readdir(join(baseDir, "session-1"));
      const content = await readFile(join(baseDir, "session-1", files[0]), "utf-8");
      const lines = content.trim().split("\n").map((l) => JSON.parse(l));

      expect(lines).toHaveLength(2);
      expect(lines[0].type).toBe("code");
      expect(lines[0].code_id).toBe("c_001");
      expect(lines[1].type).toBe("result");
      expect(lines[1].code_id).toBe("c_001");
    });

    it("should increment code_id", async () => {
      await manager.getActiveKernel("session-1", mockClient);

      const id1 = await manager.recordCode("session-1", "new-kernel-id", { code: "a", description: "1" });
      const id2 = await manager.recordCode("session-1", "new-kernel-id", { code: "b", description: "2" });

      expect(id1).toBe("c_001");
      expect(id2).toBe("c_002");
    });
  });

  describe("getHistory", () => {
    it("should return all kernel histories for a session", async () => {
      await manager.getActiveKernel("session-1", mockClient);
      await manager.recordCode("session-1", "new-kernel-id", { code: "x=1", description: "init" });

      const history = await manager.getHistory("session-1");

      expect(history).toHaveLength(1);
      expect(history[0].kernel_id).toBe("new-kernel-id");
      expect(history[0].entries).toHaveLength(1);
    });
  });

  describe("getAllSessions", () => {
    it("should list all session directories", async () => {
      await manager.getActiveKernel("session-1", mockClient);
      await manager.getActiveKernel("session-2", mockClient);

      const sessions = await manager.getAllSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.acp_session_id).sort()).toEqual(["session-1", "session-2"]);
    });
  });
});

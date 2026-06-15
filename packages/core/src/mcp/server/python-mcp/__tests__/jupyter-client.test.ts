import { describe, it, expect, vi, beforeEach } from "vitest";
import { JupyterClient } from "../jupyter-client";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("JupyterClient", () => {
  let client: JupyterClient;

  beforeEach(() => {
    client = new JupyterClient("http://localhost:8888", "test-token");
    mockFetch.mockReset();
  });

  describe("createKernel", () => {
    it("should POST to /api/kernels and return kernel_id", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "kernel-uuid-123", name: "python3" }),
      });

      const kernelId = await client.createKernel();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/api/kernels",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "token test-token",
          }),
        }),
      );
      expect(kernelId).toBe("kernel-uuid-123");
    });
  });

  describe("listKernels", () => {
    it("should GET /api/kernels and return array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: "k1", name: "python3", execution_state: "idle", last_activity: "2024-01-01T00:00:00Z" },
        ],
      });

      const kernels = await client.listKernels();

      expect(kernels).toHaveLength(1);
      expect(kernels[0].id).toBe("k1");
    });
  });

  describe("getKernelStatus", () => {
    it("should return 'alive' when kernel exists", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "k1", execution_state: "idle" }),
      });

      const status = await client.getKernelStatus("k1");
      expect(status).toBe("alive");
    });

    it("should return 'dead' when kernel not found", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const status = await client.getKernelStatus("k-missing");
      expect(status).toBe("dead");
    });
  });

  describe("interruptKernel", () => {
    it("should POST to /api/kernels/{id}/interrupt", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await client.interruptKernel("k1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/api/kernels/k1/interrupt",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});

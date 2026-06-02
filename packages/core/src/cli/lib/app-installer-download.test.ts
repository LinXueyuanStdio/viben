import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadAsset } from "./app-installer";
import { proxyFetch } from "../../http";

vi.mock("../../http", () => ({
  proxyFetch: vi.fn(),
}));

const mockProxyFetch = vi.mocked(proxyFetch);

describe("downloadAsset", () => {
  let outputDir: string;

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), "viben-app-download-"));
    mockProxyFetch.mockReset();
  });

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true });
  });

  it("includes HTTP status details when the asset request fails", async () => {
    mockProxyFetch.mockResolvedValue(new Response("forbidden", {
      status: 403,
      statusText: "Forbidden",
    }));

    await expect(downloadAsset(
      { url: "https://example.com/Viben.dmg", name: "Viben.dmg" },
      { outputDir, force: false, format: "exe" }
    )).rejects.toThrow("DOWNLOAD_FAILED: HTTP 403 Forbidden");

    expect(existsSync(join(outputDir, "Viben.dmg"))).toBe(false);
    expect(existsSync(join(outputDir, "Viben.dmg.download"))).toBe(false);
  });

  it("removes partial files when the response stream fails", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.error(new Error("socket hang up"));
      },
    });

    mockProxyFetch.mockResolvedValue(new Response(stream, {
      status: 200,
      headers: { "content-length": "6" },
    }));

    await expect(downloadAsset(
      { url: "https://example.com/Viben.dmg", name: "Viben.dmg", size: 6 },
      { outputDir, force: false, format: "exe" }
    )).rejects.toThrow("DOWNLOAD_FAILED: socket hang up");

    expect(existsSync(join(outputDir, "Viben.dmg"))).toBe(false);
    expect(existsSync(join(outputDir, "Viben.dmg.download"))).toBe(false);
  });
});

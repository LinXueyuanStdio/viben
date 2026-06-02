import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerAppCommand } from "./app";
import { downloadAsset, fetchReleaseInfo } from "../lib/app-installer";

vi.mock("../lib/app-installer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/app-installer")>();
  return {
    ...actual,
    detectAppPlatform: vi.fn(() => "darwin-arm64"),
    isPlatformSupported: vi.fn(() => true),
    fetchReleaseInfo: vi.fn(),
    downloadAsset: vi.fn(),
    getDefaultDownloadDir: vi.fn(() => "/tmp"),
  };
});

vi.mock("chalk", () => ({
  default: {
    bold: (s: string) => s,
    cyan: (s: string) => s,
    gray: (s: string) => s,
    green: (s: string) => s,
    red: (s: string) => s,
    yellow: (s: string) => s,
  },
}));

vi.spyOn(process, "exit").mockImplementation((code?: string | number | null) => {
  throw new Error(`process.exit(${code})`);
});

describe("app command", () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    program.exitOverride();
    program.option("--json", "Output as JSON");
    program.option("--verbose", "Verbose output");
    program.option("--quiet", "Quiet mode");
    registerAppCommand(program);

    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.clearAllMocks();

    vi.mocked(fetchReleaseInfo).mockResolvedValue({
      version: "1.2.11",
      tag: "v1.2.11",
      date: "2026-06-02T09:20:15Z",
      desktop: {
        assets: {
          macos: {
            arm64: {
              url: "https://example.com/Viben_1.2.11_aarch64.dmg",
              name: "Viben_1.2.11_aarch64.dmg",
              size: 57428291,
            },
            x64: { url: "", name: "" },
          },
          windows: {
            exe: { url: "", name: "" },
            msi: { url: "", name: "" },
          },
          linux: {
            deb: { url: "", name: "" },
          },
        },
      },
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("prints detailed download failures from app install", async () => {
    vi.mocked(downloadAsset).mockRejectedValue(new Error("DOWNLOAD_FAILED: socket hang up"));

    await expect(program.parseAsync(["node", "test", "app", "install"])).rejects.toThrow("process.exit(1)");

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error: Download failed: socket hang up.")
    );
  });
});

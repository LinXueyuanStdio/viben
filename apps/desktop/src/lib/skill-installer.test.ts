/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, remove, writeFile } from "@tauri-apps/plugin-fs";
import { getGatewayClient } from "./gateway";
import { downloadAndInstallClawhubSkill } from "./skill-installer";

vi.mock("@/i18n", () => ({
  default: {
    t: (key: string) => key,
  },
}));

vi.mock("@tauri-apps/api/path", () => ({
  appDataDir: vi.fn(),
  join: vi.fn(async (...parts: string[]) => parts.join("/")),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: vi.fn(),
  mkdir: vi.fn(),
  remove: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("./gateway", () => ({
  getGatewayClient: vi.fn(),
}));

const appDataDirMock = vi.mocked(appDataDir);
const joinMock = vi.mocked(join);
const existsMock = vi.mocked(exists);
const mkdirMock = vi.mocked(mkdir);
const removeMock = vi.mocked(remove);
const writeFileMock = vi.mocked(writeFile);
const getGatewayClientMock = vi.mocked(getGatewayClient);

describe("downloadAndInstallClawhubSkill", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();

    appDataDirMock.mockResolvedValue("/tmp/viben-data");
    joinMock.mockImplementation(async (...parts: string[]) => parts.join("/"));
    existsMock.mockResolvedValue(false);
    mkdirMock.mockResolvedValue(undefined);
    removeMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      }))
    );

    getGatewayClientMock.mockReturnValue({
      post: vi.fn(async () => ({
        success: true,
        name: "owner/official-skill",
        version: "2.0.0",
        path: "/skills/owner/official-skill",
        message: "Installed",
      })),
    } as unknown as ReturnType<typeof getGatewayClient>);
  });

  it("downloads a ClaWHub zip, installs it through gateway, and removes the temp zip", async () => {
    const result = await downloadAndInstallClawhubSkill({
      slug: "owner/official-skill",
      name: "Official Skill",
      version: "2.0.0",
      force: false,
    });

    const tempZipPath =
      "/tmp/viben-data/temp/owner-official-skill-2.0.0.zip";
    const fetchMock = vi.mocked(globalThis.fetch);
    const gatewayClient = getGatewayClientMock.mock.results.at(-1)?.value;
    expect(gatewayClient).toBeDefined();
    const postMock = vi.mocked(gatewayClient.post);

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clawhub.ai/api/v1/packages/owner%2Fofficial-skill/download?version=2.0.0",
      { headers: { Accept: "application/zip" } }
    );
    expect(appDataDirMock).toHaveBeenCalled();
    expect(existsMock).toHaveBeenCalledWith("/tmp/viben-data/temp");
    expect(mkdirMock).toHaveBeenCalledWith("/tmp/viben-data/temp", {
      recursive: true,
    });
    expect(writeFileMock).toHaveBeenCalledWith(
      tempZipPath,
      new Uint8Array([1, 2, 3])
    );
    expect(postMock).toHaveBeenCalledWith("/api/skill/install", {
      name: "owner/official-skill",
      zip_path: tempZipPath,
      force: false,
      version: "2.0.0",
    });
    expect(removeMock).toHaveBeenCalledWith(tempZipPath);
  });

  it('omits the ClaWHub download version query when display version is "0.0.0"', async () => {
    const result = await downloadAndInstallClawhubSkill({
      slug: "owner/latest-only-skill",
      name: "Latest Only Skill",
      version: "0.0.0",
      force: false,
    });

    const tempZipPath =
      "/tmp/viben-data/temp/owner-latest-only-skill-0.0.0.zip";
    const fetchMock = vi.mocked(globalThis.fetch);
    const gatewayClient = getGatewayClientMock.mock.results.at(-1)?.value;
    expect(gatewayClient).toBeDefined();
    const postMock = vi.mocked(gatewayClient.post);

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clawhub.ai/api/v1/packages/owner%2Flatest-only-skill/download",
      { headers: { Accept: "application/zip" } }
    );
    expect(postMock).toHaveBeenCalledWith("/api/skill/install", {
      name: "owner/latest-only-skill",
      zip_path: tempZipPath,
      force: false,
      version: "0.0.0",
    });
  });
});

/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getGatewayClient } from "./gateway";
import {
  downloadAndInstallClawhubSkill,
  downloadAndInstallSkill,
} from "./skill-installer";

vi.mock("@/i18n", () => ({
  default: {
    t: (key: string) => key,
  },
}));

vi.mock("./gateway", () => ({
  getGatewayClient: vi.fn(),
}));

const getGatewayClientMock = vi.mocked(getGatewayClient);

describe("skill installer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();

    vi.stubGlobal("fetch", vi.fn());

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

  it("installs a platform skill through Gateway without desktop skill download", async () => {
    const result = await downloadAndInstallSkill({
      package: {
        id: "skill-id",
        name: "Cloud Skill",
        slug: "cloud-skill",
        version: "1.2.3",
      },
      force: true,
    });

    const gatewayClient = getGatewayClientMock.mock.results.at(-1)?.value;
    expect(gatewayClient).toBeDefined();
    const postMock = vi.mocked(gatewayClient.post);

    expect(result.success).toBe(true);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(postMock).toHaveBeenCalledWith("/api/skill/install", {
      name: "cloud-skill",
      force: true,
      version: "1.2.3",
      registry: "viben",
    });
  });

  it("installs a ClaWHub skill through Gateway instead of desktop download", async () => {
    const result = await downloadAndInstallClawhubSkill({
      slug: "owner/official-skill",
      name: "Official Skill",
      version: "2.0.0",
      force: false,
    });

    const gatewayClient = getGatewayClientMock.mock.results.at(-1)?.value;
    expect(gatewayClient).toBeDefined();
    const postMock = vi.mocked(gatewayClient.post);

    expect(result.success).toBe(true);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(postMock).toHaveBeenCalledWith("/api/skill/install", {
      name: "owner/official-skill",
      force: false,
      version: "2.0.0",
      registry: "clawhub",
    });
  });

  it('omits the ClaWHub install version when display version is "0.0.0"', async () => {
    const result = await downloadAndInstallClawhubSkill({
      slug: "owner/latest-only-skill",
      name: "Latest Only Skill",
      version: "0.0.0",
      force: false,
    });

    const gatewayClient = getGatewayClientMock.mock.results.at(-1)?.value;
    expect(gatewayClient).toBeDefined();
    const postMock = vi.mocked(gatewayClient.post);

    expect(result.success).toBe(true);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(postMock).toHaveBeenCalledWith("/api/skill/install", {
      name: "owner/latest-only-skill",
      force: false,
      version: undefined,
      registry: "clawhub",
    });
  });
});

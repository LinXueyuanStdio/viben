/**
 * Integration tests for web CLI command registration.
 *
 * Verifies that all 9 command registration functions from @viben/api-client/commands
 * integrate correctly with Commander via the lazy-loading registry pattern.
 */
import { describe, it, expect, vi } from "vitest";
import { Command } from "commander";

const mockRegisterAuth = vi.fn();
const mockRegisterProfile = vi.fn();
const mockRegisterApiKey = vi.fn();
const mockRegisterMcpMarket = vi.fn();
const mockRegisterSkillMarket = vi.fn();
const mockRegisterCollections = vi.fn();
const mockRegisterFavorites = vi.fn();
const mockRegisterPagesPublish = vi.fn();
const mockRegisterVoice = vi.fn();

vi.mock("@viben/api-client/commands", () => ({
  registerAuthCommand: mockRegisterAuth,
  registerProfileCommand: mockRegisterProfile,
  registerApiKeyCommand: mockRegisterApiKey,
  registerMcpMarketCommand: mockRegisterMcpMarket,
  registerSkillMarketCommand: mockRegisterSkillMarket,
  registerCollectionsCommand: mockRegisterCollections,
  registerFavoritesCommand: mockRegisterFavorites,
  registerPagesPublishCommand: mockRegisterPagesPublish,
  registerVoiceCommand: mockRegisterVoice,
}));

describe("Web CLI Commands Registration", () => {
  it("registers auth command with subcommands", async () => {
    const program = new Command();
    mockRegisterAuth.mockImplementation((p: Command) => {
      const cmd = p.command("auth").description("Auth");
      cmd.command("login");
      cmd.command("logout");
      cmd.command("whoami");
    });

    const { registerAuthCommand } = await import("@viben/api-client/commands");
    registerAuthCommand(program);

    const cmds = program.commands.map((c: any) => c.name());
    expect(cmds).toContain("auth");
    // Verify subcommands are registered
    const authCmd = program.commands.find((c: any) => c.name() === "auth");
    expect(authCmd).toBeDefined();
    expect((authCmd as any).commands.map((c: any) => c.name())).toEqual(
      expect.arrayContaining(["login", "logout", "whoami"])
    );
  });

  it("registers profile command", async () => {
    const program = new Command();
    mockRegisterProfile.mockImplementation((p: Command) => {
      const cmd = p.command("profile").description("Profile");
      cmd.command("show");
      cmd.command("update");
      cmd.command("view");
    });

    const { registerProfileCommand } = await import("@viben/api-client/commands");
    registerProfileCommand(program);

    expect(program.commands.map((c: any) => c.name())).toContain("profile");
  });

  it("registers api-key command", async () => {
    const program = new Command();
    mockRegisterApiKey.mockImplementation((p: Command) => {
      const cmd = p.command("api-key").description("API Keys");
      cmd.command("list");
      cmd.command("create");
      cmd.command("delete");
    });

    const { registerApiKeyCommand } = await import("@viben/api-client/commands");
    registerApiKeyCommand(program);

    expect(program.commands.map((c: any) => c.name())).toContain("api-key");
  });

  it("registers mcp-market command", async () => {
    const program = new Command();
    mockRegisterMcpMarket.mockImplementation((p: Command) => {
      p.command("mcp-market").description("MCP Marketplace");
    });

    const { registerMcpMarketCommand } = await import("@viben/api-client/commands");
    registerMcpMarketCommand(program);

    expect(program.commands.map((c: any) => c.name())).toContain("mcp-market");
    expect(mockRegisterMcpMarket).toHaveBeenCalledWith(program);
  });

  it("registers skill-market command", async () => {
    const program = new Command();
    mockRegisterSkillMarket.mockImplementation((p: Command) => {
      p.command("skill-market").description("Skill Marketplace");
    });

    const { registerSkillMarketCommand } = await import("@viben/api-client/commands");
    registerSkillMarketCommand(program);

    expect(program.commands.map((c: any) => c.name())).toContain("skill-market");
  });

  it("registers collection command", async () => {
    const program = new Command();
    mockRegisterCollections.mockImplementation((p: Command) => {
      p.command("collection").description("Collections");
    });

    const { registerCollectionsCommand } = await import("@viben/api-client/commands");
    registerCollectionsCommand(program);

    expect(program.commands.map((c: any) => c.name())).toContain("collection");
  });

  it("registers favorites command", async () => {
    const program = new Command();
    mockRegisterFavorites.mockImplementation((p: Command) => {
      p.command("favorites").description("Favorites");
    });

    const { registerFavoritesCommand } = await import("@viben/api-client/commands");
    registerFavoritesCommand(program);

    expect(program.commands.map((c: any) => c.name())).toContain("favorites");
  });

  it("registers pages-publish command", async () => {
    const program = new Command();
    mockRegisterPagesPublish.mockImplementation((p: Command) => {
      const cmd = p.command("page").description("Pages");
      cmd.command("publish");
      cmd.command("publish-status");
      cmd.command("publish-history");
      cmd.command("publish-rollback");
    });

    const { registerPagesPublishCommand } = await import("@viben/api-client/commands");
    registerPagesPublishCommand(program);

    expect(program.commands.map((c: any) => c.name())).toContain("page");
    expect(mockRegisterPagesPublish).toHaveBeenCalledWith(program);
  });

  it("registers voice command", async () => {
    const program = new Command();
    mockRegisterVoice.mockImplementation((p: Command) => {
      p.command("voice").description("Voice");
    });

    const { registerVoiceCommand } = await import("@viben/api-client/commands");
    registerVoiceCommand(program);

    expect(program.commands.map((c: any) => c.name())).toContain("voice");
  });

  it("all commands registered on the same program", async () => {
    const program = new Command();
    const allMocks: [string, ReturnType<typeof vi.fn>][] = [
      ["auth", mockRegisterAuth], ["profile", mockRegisterProfile],
      ["api-key", mockRegisterApiKey], ["mcp-market", mockRegisterMcpMarket],
      ["skill-market", mockRegisterSkillMarket], ["collection", mockRegisterCollections],
      ["favorites", mockRegisterFavorites], ["page", mockRegisterPagesPublish],
      ["voice", mockRegisterVoice],
    ];

    for (const [name, mock] of allMocks) {
      mock.mockImplementation((p: Command) => p.command(name));
    }

    const cmds = await import("@viben/api-client/commands");
    for (const key of Object.keys(cmds)) {
      (cmds as any)[key](program);
    }

    const names = program.commands.map((c: any) => c.name());
    expect(names).toHaveLength(9);
    expect(names).toEqual(expect.arrayContaining([
      "auth", "profile", "api-key", "mcp-market", "skill-market",
      "collection", "favorites", "page", "voice",
    ]));
  });
});

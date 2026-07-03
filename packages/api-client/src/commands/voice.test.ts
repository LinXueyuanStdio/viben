/**
 * Tests for registerVoiceCommand
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Command } from "commander";
import { registerVoiceCommand } from "./voice";

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  readToken: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("../client", () => ({
  VibenClient: class {
    constructor(_config: unknown) {}
    get voice() {
      return { getToken: mocks.getToken };
    }
  },
}));

vi.mock("../proxy-fetch", () => ({
  proxyFetch: (...args: any[]) => mocks.fetch(...args),
  getProxyUrl: () => undefined,
  hasProxy: () => false,
  createProxyFetch: () => mocks.fetch,
}));

vi.mock("../utils/token", () => ({
  readToken: mocks.readToken,
  writeToken: vi.fn(),
  deleteToken: vi.fn(),
  validateTokenFormat: (t: string) => /^bmcp_/.test(t),
}));

vi.mock("../utils/config", () => ({
  getWebUrl: () => "https://test.example.com",
}));

const TOKEN = "bmcp_12345678_abcdefghijklmnopqrstuvwx";
const VOICE_RESPONSE = {
  livekit_url: "wss://livekit.example.com",
  room_name: "room-123",
  participant_identity: "user-1",
  token: "eyJhbGciOiJIUzI1NiJ9...",
  expires_in: 3600,
};

describe("registerVoiceCommand", () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerVoiceCommand(program);
  });

  it("gets voice token with --api-key and --agent-id", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.getToken.mockResolvedValue(VOICE_RESPONSE);
    await program.parseAsync([
      "node",
      "viben",
      "voice",
      "--api-key",
      "vk_abc123",
      "--agent-id",
      "agent-1",
    ]);
    expect(mocks.getToken).toHaveBeenCalledWith({
      api_key: "vk_abc123",
      agent_id: "agent-1",
      participant_name: undefined,
    });
  });

  it("passes --name as participant_name", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.getToken.mockResolvedValue(VOICE_RESPONSE);
    await program.parseAsync([
      "node",
      "viben",
      "voice",
      "--api-key",
      "vk_abc123",
      "--agent-id",
      "agent-1",
      "--name",
      "Alice",
    ]);
    expect(mocks.getToken).toHaveBeenCalledWith({
      api_key: "vk_abc123",
      agent_id: "agent-1",
      participant_name: "Alice",
    });
  });

  it("requires auth", async () => {
    mocks.readToken.mockResolvedValue(null);
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "voice",
        "--api-key",
        "vk_abc123",
        "--agent-id",
        "agent-1",
      ]),
    ).rejects.toThrow();
  });

  it("exits when --api-key is missing", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "voice",
        "--agent-id",
        "agent-1",
      ]),
    ).rejects.toThrow();
  });

  it("exits when --agent-id is missing", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "voice",
        "--api-key",
        "vk_abc123",
      ]),
    ).rejects.toThrow();
  });
});

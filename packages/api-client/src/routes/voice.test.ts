import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerVoiceProxyRoutes } from "./voice";

const mocks = vi.hoisted(() => {
  class MockApiError extends Error {
    status: number;
    constructor(msg: string, s: number) {
      super(msg);
      this.name = "ApiError";
      this.status = s;
    }
  }
  return {
    MockApiError,
    getToken: vi.fn(), fetch: vi.fn(),
  };
});

vi.mock("../client", () => ({
  VibenClient: class {
    constructor(_config: unknown) {}
    get voice() { return { getToken: mocks.getToken }; }
  },
  ApiError: mocks.MockApiError,
}));

const TOKEN = "bmcp_12345678_abcdefghijklmnopqrstuvwx";
const VOICE_RESULT = {
  livekit_url: "wss://livekit.example.com",
  token: "jwt_token_here",
  room_name: "room_123",
  participant_identity: "user_test",
  expires_in: 3600,
  agent_mode: "default",
};

describe("Voice Proxy Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });
    registerVoiceProxyRoutes(app, { baseUrl: "https://test.example.com", fetch: mocks.fetch as any });
    await app.ready();
  });

  afterEach(async () => { await app.close(); });

  describe("POST /api/voice/token", () => {
    it("returns voice token", async () => {
      mocks.getToken.mockResolvedValue(VOICE_RESULT);
      const res = await app.inject({
        method: "POST", url: "/api/voice/token",
        headers: { authorization: `Bearer ${TOKEN}` },
        payload: { api_key: "vb_key", agent_id: "agent1" },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.token).toBe("jwt_token_here");
      expect(body.livekit_url).toContain("livekit");
      expect(body.room_name).toBe("room_123");
      expect(body.expires_in).toBe(3600);
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST", url: "/api/voice/token",
        payload: { api_key: "vb_key", agent_id: "agent1" },
      });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe("Authentication required");
    });

    it("accepts token from query parameter", async () => {
      mocks.getToken.mockResolvedValue(VOICE_RESULT);
      const res = await app.inject({
        method: "POST", url: `/api/voice/token?access_token=${TOKEN}`,
        payload: { api_key: "vb_key", agent_id: "agent1" },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.token).toBe("jwt_token_here");
    });

    it("propagates error from client.getToken", async () => {
      mocks.getToken.mockRejectedValue(
        new mocks.MockApiError("Invalid agent_id", 404)
      );
      const res = await app.inject({
        method: "POST", url: "/api/voice/token",
        headers: { authorization: `Bearer ${TOKEN}` },
        payload: { api_key: "vb_key", agent_id: "nonexistent" },
      });
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).error).toBe("Invalid agent_id");
    });

    it("propagates error when api_key is missing", async () => {
      mocks.getToken.mockRejectedValue(
        new mocks.MockApiError("api_key is required", 400)
      );
      const res = await app.inject({
        method: "POST", url: "/api/voice/token",
        headers: { authorization: `Bearer ${TOKEN}` },
        payload: { agent_id: "agent1" },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toBe("api_key is required");
    });
  });
});

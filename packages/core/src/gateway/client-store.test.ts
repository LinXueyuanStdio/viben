import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ClientStore } from "./client-store";

vi.mock("../utils/crypto", () => ({
  verify: vi.fn().mockResolvedValue(true),
  sign: vi.fn().mockResolvedValue("mock_signature"),
  generateKeyPair: vi.fn().mockReturnValue({
    publicKey: "mock_public_key",
    privateKey: "mock_private_key",
  }),
}));

function createMockRegisterOptions(socketId: string, source: "main_window" | "page_iframe" = "main_window") {
  return {
    source,
    socketId,
    publicKey: "mock_public_key",
    signature: "mock_signature",
    timestamp: Date.now(),
  };
}

describe("ClientStore", () => {
  let store: ClientStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new ClientStore({ gracePeriodMs: 1000 });
  });

  afterEach(() => {
    store.shutdown();
    vi.useRealTimers();
  });

  describe("client management", () => {
    it("should register a new client with signature verification", async () => {
      await store.registerClient("client_abc", createMockRegisterOptions("socket_1"));

      const client = store.getClient("client_abc");
      expect(client).toBeDefined();
      expect(client?.sockets.size).toBe(1);
      expect(client?.publicKey).toBe("mock_public_key");
    });

    it("should reject client with mismatched public key", async () => {
      await store.registerClient("client_abc", createMockRegisterOptions("socket_1"));

      await expect(
        store.registerClient("client_abc", {
          ...createMockRegisterOptions("socket_2"),
          publicKey: "different_key",
        })
      ).rejects.toThrow("Public key mismatch");
    });

    it("should add socket to existing client", async () => {
      await store.registerClient("client_abc", createMockRegisterOptions("socket_1"));
      await store.registerClient("client_abc", {
        ...createMockRegisterOptions("socket_2"),
        source: "page_iframe",
        pageUid: "canvas",
      });

      const client = store.getClient("client_abc");
      expect(client?.sockets.size).toBe(2);
    });

    it("should start grace period when all sockets disconnect", async () => {
      await store.registerClient("client_abc", createMockRegisterOptions("socket_1"));

      store.removeSocket("client_abc", "socket_1");

      expect(store.getClient("client_abc")).toBeDefined();

      vi.advanceTimersByTime(1500);

      expect(store.getClient("client_abc")).toBeUndefined();
    });

    it("should cancel grace period when new socket connects", async () => {
      await store.registerClient("client_abc", createMockRegisterOptions("socket_1"));
      store.removeSocket("client_abc", "socket_1");

      vi.advanceTimersByTime(500);
      await store.registerClient("client_abc", createMockRegisterOptions("socket_2"));

      vi.advanceTimersByTime(1000);

      expect(store.getClient("client_abc")).toBeDefined();
    });
  });

  describe("action management", () => {
    it("should register action for a socket", async () => {
      await store.registerClient("client_abc", {
        ...createMockRegisterOptions("socket_1"),
        source: "page_iframe",
        pageUid: "canvas",
      });

      const result = store.registerAction("client_abc", "socket_1", {
        namespace: "canvas",
        name: "create_node",
        description: "Create a node",
      });

      expect(result.updated).toBe(true);
      const action = store.findAction("client_abc", "canvas", "create_node");
      expect(action).toBeDefined();
      expect(action?.socketId).toBe("socket_1");
    });

    it("should support custom timeout per action", async () => {
      await store.registerClient("client_abc", createMockRegisterOptions("socket_1"));

      store.registerAction("client_abc", "socket_1", {
        namespace: "canvas",
        name: "slow_action",
        description: "A slow action",
        timeout: 60000,
      });

      const action = store.findAction("client_abc", "canvas", "slow_action");
      expect(action?.timeout).toBe(60000);
    });

    it("should enforce max actions limit", async () => {
      const limitedStore = new ClientStore({ maxActionsPerClient: 2 });
      await limitedStore.registerClient("client_abc", createMockRegisterOptions("socket_1"));

      limitedStore.registerAction("client_abc", "socket_1", {
        namespace: "ns", name: "a1", description: "Action 1",
      });
      limitedStore.registerAction("client_abc", "socket_1", {
        namespace: "ns", name: "a2", description: "Action 2",
      });

      const result = limitedStore.registerAction("client_abc", "socket_1", {
        namespace: "ns", name: "a3", description: "Action 3",
      });

      expect(result.error).toBe("Max actions limit reached");
      expect(result.updated).toBe(false);

      limitedStore.shutdown();
    });

    it("should be idempotent - same content skips update", async () => {
      await store.registerClient("client_abc", createMockRegisterOptions("socket_1"));

      const result1 = store.registerAction("client_abc", "socket_1", {
        namespace: "canvas",
        name: "create_node",
        description: "Create a node",
      });

      const result2 = store.registerAction("client_abc", "socket_1", {
        namespace: "canvas",
        name: "create_node",
        description: "Create a node",
      });

      expect(result1.updated).toBe(true);
      expect(result2.updated).toBe(false);
    });

    it("should preserve actions during grace period", async () => {
      await store.registerClient("client_abc", createMockRegisterOptions("socket_1"));
      store.registerAction("client_abc", "socket_1", {
        namespace: "canvas",
        name: "create_node",
        description: "Create a node",
      });

      store.removeSocket("client_abc", "socket_1");

      expect(store.findAction("client_abc", "canvas", "create_node")).toBeDefined();

      vi.advanceTimersByTime(1500);
      expect(store.findAction("client_abc", "canvas", "create_node")).toBeUndefined();
    });
  });

  describe("getAllActions", () => {
    it("should return all actions across clients", async () => {
      await store.registerClient("client_a", createMockRegisterOptions("s1"));
      await store.registerClient("client_b", {
        ...createMockRegisterOptions("s2"),
        publicKey: "mock_public_key",
      });

      store.registerAction("client_a", "s1", {
        namespace: "canvas",
        name: "create_node",
        description: "Create",
      });
      store.registerAction("client_b", "s2", {
        namespace: "editor",
        name: "save",
        description: "Save",
      });

      const all = store.getAllActions();
      expect(all).toHaveLength(2);
      expect(all.map(a => a.clientId)).toContain("client_a");
      expect(all.map(a => a.clientId)).toContain("client_b");
    });
  });
});

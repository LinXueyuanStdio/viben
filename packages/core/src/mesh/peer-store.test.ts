import { describe, it, expect, beforeEach, vi } from "vitest";
import { PeerStore } from "./peer-store";
import type { PersistedPeer } from "./types";

// Mock config/yaml
vi.mock("../config/yaml", () => ({
  readYaml: vi.fn(),
  writeYaml: vi.fn(),
}));

import { readYaml, writeYaml } from "../config/yaml";

describe("PeerStore", () => {
  let store: PeerStore;

  beforeEach(() => {
    store = new PeerStore("/tmp/test-peers.yaml");
    vi.clearAllMocks();
  });

  it("should load peers from YAML", async () => {
    const peers: PersistedPeer[] = [
      { gateway_id: "gw-1", name: "Desktop B", lan: "http://192.168.1.101:18790", last_seen: "2026-04-11T00:00:00Z" },
    ];
    vi.mocked(readYaml).mockResolvedValue({ peers });
    const result = await store.load();
    expect(result).toHaveLength(1);
    expect(result[0].gateway_id).toBe("gw-1");
  });

  it("should return empty array if file missing", async () => {
    vi.mocked(readYaml).mockResolvedValue(undefined);
    const result = await store.load();
    expect(result).toEqual([]);
  });

  it("should save peers to YAML", async () => {
    const peer: PersistedPeer = { gateway_id: "gw-1", name: "B", lan: "http://192.168.1.101:18790", last_seen: "2026-04-11T00:00:00Z" };
    await store.save([peer]);
    expect(writeYaml).toHaveBeenCalledWith("/tmp/test-peers.yaml", { peers: [peer] });
  });

  it("should upsert a peer", async () => {
    vi.mocked(readYaml).mockResolvedValue({ peers: [
      { gateway_id: "gw-1", name: "Old", last_seen: "2026-01-01T00:00:00Z" },
    ] });
    await store.upsert({ gateway_id: "gw-1", name: "New", lan: "http://new:18790", last_seen: "2026-04-11T00:00:00Z" });
    expect(writeYaml).toHaveBeenCalledWith("/tmp/test-peers.yaml", {
      peers: [expect.objectContaining({ gateway_id: "gw-1", name: "New" })],
    });
  });

  it("should remove a peer", async () => {
    vi.mocked(readYaml).mockResolvedValue({ peers: [
      { gateway_id: "gw-1", name: "B", last_seen: "2026-01-01T00:00:00Z" },
    ] });
    await store.remove("gw-1");
    expect(writeYaml).toHaveBeenCalledWith("/tmp/test-peers.yaml", { peers: [] });
  });
});

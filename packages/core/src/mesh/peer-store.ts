import { join } from "node:path";
import { homedir } from "node:os";
import { readYaml, writeYaml } from "../config/yaml";
import type { PersistedPeer } from "./types";

interface PeerStoreData {
  peers: PersistedPeer[];
}

const DEFAULT_PATH = join(homedir(), ".viben", "mesh", "peers.yaml");

export class PeerStore {
  constructor(private path: string = DEFAULT_PATH) {}

  async load(): Promise<PersistedPeer[]> {
    const data = await readYaml<PeerStoreData>(this.path);
    return data?.peers ?? [];
  }

  async save(peers: PersistedPeer[]): Promise<void> {
    await writeYaml(this.path, { peers });
  }

  async upsert(peer: PersistedPeer): Promise<void> {
    const peers = await this.load();
    const idx = peers.findIndex((p) => p.gateway_id === peer.gateway_id);
    if (idx >= 0) {
      peers[idx] = peer;
    } else {
      peers.push(peer);
    }
    await this.save(peers);
  }

  async remove(gatewayId: string): Promise<void> {
    const peers = await this.load();
    await this.save(peers.filter((p) => p.gateway_id !== gatewayId));
  }
}

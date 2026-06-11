import { create } from "zustand";
import { persist } from "zustand/middleware";
import * as ed from "@noble/ed25519";

interface ClientIdentity {
  clientId: string;
  publicKey: string;
  privateKey: string;
}

interface ClientIdState {
  identity: ClientIdentity | null;
  getOrCreateIdentity: () => Promise<ClientIdentity>;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function generateIdentity(): Promise<ClientIdentity> {
  const privateKey = ed.utils.randomSecretKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);

  const clientId = `client_${bytesToHex(publicKey).slice(0, 16)}`;

  return {
    clientId,
    publicKey: bytesToHex(publicKey),
    privateKey: bytesToHex(privateKey),
  };
}

export const useClientIdStore = create<ClientIdState>()(
  persist(
    (set, get) => ({
      identity: null,
      getOrCreateIdentity: async () => {
        let identity = get().identity;
        if (!identity) {
          identity = await generateIdentity();
          set({ identity });
        }
        return identity;
      },
    }),
    {
      name: "viben-client-identity",
    }
  )
);

export function getIdentitySync(): ClientIdentity | null {
  return useClientIdStore.getState().identity;
}

export async function getOrCreateIdentity(): Promise<ClientIdentity> {
  return useClientIdStore.getState().getOrCreateIdentity();
}

export type { ClientIdentity };

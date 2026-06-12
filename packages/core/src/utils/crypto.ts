import { createPublicKey, createPrivateKey, sign as cryptoSign, verify as cryptoVerify, generateKeyPairSync } from "node:crypto";

export interface KeyPair {
  publicKey: string;   // hex encoded
  privateKey: string;  // hex encoded
}

export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });

  return {
    publicKey: publicKey.toString("hex"),
    privateKey: privateKey.toString("hex"),
  };
}

export async function sign(message: string, privateKeyHex: string): Promise<string> {
  const privateKeyDer = Buffer.from(privateKeyHex, "hex");
  const privateKey = createPrivateKey({
    key: privateKeyDer,
    format: "der",
    type: "pkcs8",
  });

  const signature = cryptoSign(null, Buffer.from(message), privateKey);
  return signature.toString("hex");
}

// SPKI header for Ed25519: OID 1.3.101.112
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export async function verify(message: string, signatureHex: string, publicKeyHex: string): Promise<boolean> {
  try {
    const publicKeyBytes = Buffer.from(publicKeyHex, "hex");
    let publicKeyDer: Buffer;

    if (publicKeyBytes.length === 32) {
      // Raw 32-byte Ed25519 public key (from @noble/ed25519) — wrap in SPKI
      publicKeyDer = Buffer.concat([ED25519_SPKI_PREFIX, publicKeyBytes]);
    } else {
      // Already SPKI DER encoded
      publicKeyDer = publicKeyBytes;
    }

    const publicKey = createPublicKey({
      key: publicKeyDer,
      format: "der",
      type: "spki",
    });

    const signature = Buffer.from(signatureHex, "hex");
    return cryptoVerify(null, Buffer.from(message), publicKey, signature);
  } catch {
    return false;
  }
}

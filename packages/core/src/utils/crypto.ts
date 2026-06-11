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

export async function verify(message: string, signatureHex: string, publicKeyHex: string): Promise<boolean> {
  try {
    const publicKeyDer = Buffer.from(publicKeyHex, "hex");
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

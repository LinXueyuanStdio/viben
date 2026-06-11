import { describe, it, expect } from "vitest";
import { generateKeyPair, sign, verify } from "./crypto";

describe("crypto", () => {
  describe("generateKeyPair", () => {
    it("should generate valid Ed25519 key pair", () => {
      const { publicKey, privateKey } = generateKeyPair();

      expect(publicKey).toBeDefined();
      expect(privateKey).toBeDefined();
      // SPKI DER encoding for Ed25519 public key is 44 bytes (88 hex chars)
      expect(publicKey).toHaveLength(88);
      // PKCS8 DER encoding for Ed25519 private key is 48 bytes (96 hex chars)
      expect(privateKey).toHaveLength(96);
    });
  });

  describe("sign and verify", () => {
    it("should sign and verify message", async () => {
      const { publicKey, privateKey } = generateKeyPair();
      const message = "test message";

      const signature = await sign(message, privateKey);
      const valid = await verify(message, signature, publicKey);

      expect(valid).toBe(true);
    });

    it("should reject tampered message", async () => {
      const { publicKey, privateKey } = generateKeyPair();
      const message = "test message";

      const signature = await sign(message, privateKey);
      const valid = await verify("tampered message", signature, publicKey);

      expect(valid).toBe(false);
    });

    it("should reject wrong public key", async () => {
      const keyPair1 = generateKeyPair();
      const keyPair2 = generateKeyPair();
      const message = "test message";

      const signature = await sign(message, keyPair1.privateKey);
      const valid = await verify(message, signature, keyPair2.publicKey);

      expect(valid).toBe(false);
    });
  });
});

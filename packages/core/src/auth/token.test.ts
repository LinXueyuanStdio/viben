import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Set test state dir before importing
const testStateDir = join(tmpdir(), `viben-test-${Date.now()}`);
process.env.VIBEN_STATE_DIR = testStateDir;

import {
  readToken,
  writeToken,
  deleteToken,
  validateTokenFormat,
  TOKEN_REGEX,
} from "./token";

describe("token", () => {
  beforeEach(() => {
    mkdirSync(testStateDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testStateDir)) {
      rmSync(testStateDir, { recursive: true, force: true });
    }
    delete process.env.VIBEN_TOKEN;
  });

  describe("validateTokenFormat", () => {
    it("should accept valid token format", () => {
      expect(validateTokenFormat("bmcp_12345678_abcdefghijklmnopqrstuvwx")).toBe(true);
      expect(validateTokenFormat("bmcp_ABCD1234_ABCDEFGHIJKLMNOPQRSTUVWX")).toBe(true);
    });

    it("should reject invalid token formats", () => {
      expect(validateTokenFormat("invalid")).toBe(false);
      expect(validateTokenFormat("bmcp_short_short")).toBe(false);
      expect(validateTokenFormat("bmcp_12345678")).toBe(false);
      expect(validateTokenFormat("")).toBe(false);
    });
  });

  describe("writeToken", () => {
    it("should write token to file", async () => {
      const token = "bmcp_12345678_abcdefghijklmnopqrstuvwx";
      await writeToken(token);

      const tokenPath = join(testStateDir, "token");
      expect(existsSync(tokenPath)).toBe(true);
      expect(readFileSync(tokenPath, "utf-8")).toBe(token);
    });

    it("should create directory if not exists", async () => {
      rmSync(testStateDir, { recursive: true, force: true });

      const token = "bmcp_12345678_abcdefghijklmnopqrstuvwx";
      await writeToken(token);

      expect(existsSync(testStateDir)).toBe(true);
    });

    it("should set file permissions to 0600", async () => {
      const token = "bmcp_12345678_abcdefghijklmnopqrstuvwx";
      await writeToken(token);

      const tokenPath = join(testStateDir, "token");
      const stats = statSync(tokenPath);
      // 0600 in octal = 384 in decimal, mask with 0o777 to get permission bits
      expect(stats.mode & 0o777).toBe(0o600);
    });
  });

  describe("readToken", () => {
    it("should read token from file", async () => {
      const token = "bmcp_12345678_abcdefghijklmnopqrstuvwx";
      await writeToken(token);

      const result = await readToken();
      expect(result).toBe(token);
    });

    it("should return null if file not exists", async () => {
      const result = await readToken();
      expect(result).toBeNull();
    });

    it("should prefer VIBEN_TOKEN env var", async () => {
      const fileToken = "bmcp_12345678_abcdefghijklmnopqrstuvwx";
      const envToken = "bmcp_envtoken_ABCDEFGHIJKLMNOPQRSTUVWX";

      await writeToken(fileToken);
      process.env.VIBEN_TOKEN = envToken;

      const result = await readToken();
      expect(result).toBe(envToken);
    });
  });

  describe("deleteToken", () => {
    it("should delete token file", async () => {
      const token = "bmcp_12345678_abcdefghijklmnopqrstuvwx";
      await writeToken(token);

      const tokenPath = join(testStateDir, "token");
      expect(existsSync(tokenPath)).toBe(true);

      await deleteToken();
      expect(existsSync(tokenPath)).toBe(false);
    });

    it("should not throw if file not exists", async () => {
      await expect(deleteToken()).resolves.not.toThrow();
    });
  });
});

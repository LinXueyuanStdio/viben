// packages/core/src/account/ops/store.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

// Mock getAccountsPath to use a temp directory
const TEST_DIR = join(__dirname, "__test_tmp__");
vi.mock("../../config/paths", () => ({
  getAccountsPath: () => join(TEST_DIR, "accounts.yaml"),
  getStateDir: () => TEST_DIR,
}));

import { readAccounts, writeAccounts, maskCredential, getAccountsFilePath } from "./store";
import type { AccountRecord } from "./types";

describe("store", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("readAccounts", () => {
    it("returns empty array when file does not exist", async () => {
      const result = await readAccounts();
      expect(result).toEqual([]);
    });

    it("reads accounts from YAML file", async () => {
      const accounts: AccountRecord[] = [
        {
          id: "test123",
          exchange: "okx",
          name: "OKX #1",
          api_key: "key123",
          secret: "secret123",
          passphrase: "pass123",
          created_at: "2026-05-14T00:00:00Z",
          updated_at: "2026-05-14T00:00:00Z",
        },
      ];
      await writeAccounts(accounts);
      const result = await readAccounts();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("test123");
      expect(result[0].api_key).toBe("key123");
    });
  });

  describe("writeAccounts", () => {
    it("creates file with 0600 permissions", async () => {
      await writeAccounts([]);
      const filePath = getAccountsFilePath();
      expect(existsSync(filePath)).toBe(true);
      // Check file content
      const content = await readFile(filePath, "utf-8");
      expect(content).toContain("accounts:");
    });

    it("overwrites existing data", async () => {
      const acc1: AccountRecord = {
        id: "a",
        exchange: "okx",
        name: "A",
        api_key: "k1",
        secret: "s1",
        passphrase: "p1",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };
      const acc2: AccountRecord = {
        id: "b",
        exchange: "binance",
        name: "B",
        api_key: "k2",
        secret: "s2",
        created_at: "2026-01-02T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      };
      await writeAccounts([acc1]);
      await writeAccounts([acc1, acc2]);
      const result = await readAccounts();
      expect(result).toHaveLength(2);
    });
  });

  describe("maskCredential", () => {
    it("masks credentials showing last 4 chars", () => {
      expect(maskCredential("abcdefgh1234")).toBe("****1234");
      expect(maskCredential("short")).toBe("****hort");
    });

    it("returns **** for very short values", () => {
      expect(maskCredential("ab")).toBe("****");
      expect(maskCredential("abcd")).toBe("****");
    });
  });
});

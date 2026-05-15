// packages/core/src/account/ops/crud.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";

const TEST_DIR = join(__dirname, "__test_tmp_crud__");
vi.mock("../../config/paths", () => ({
  getAccountsPath: () => join(TEST_DIR, "accounts.yaml"),
  getStateDir: () => TEST_DIR,
}));

import {
  listAccounts,
  addAccount,
  viewAccount,
  updateAccount,
  removeAccount,
  findAccount,
} from "./crud";

describe("crud", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("addAccount", () => {
    it("creates account with valid input", async () => {
      const result = await addAccount({
        exchange: "okx",
        name: "OKX Test",
        api_key: "test-api-key-12345678",
        secret: "test-secret-12345678",
        passphrase: "test-passphrase",
      });
      expect(result.success).toBe(true);
      expect(result.account).toBeDefined();
      expect(result.account!.name).toBe("OKX Test");
      expect(result.account!.exchange).toBe("okx");
      expect(result.account!.id).toHaveLength(12);
    });

    it("rejects empty api_key", async () => {
      const result = await addAccount({
        exchange: "okx",
        name: "Test",
        api_key: "  ",
        secret: "secret",
        passphrase: "pass",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("api_key");
    });

    it("rejects missing passphrase for OKX", async () => {
      const result = await addAccount({
        exchange: "okx",
        name: "Test",
        api_key: "key",
        secret: "secret",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("passphrase");
    });

    it("allows missing passphrase for Binance", async () => {
      const result = await addAccount({
        exchange: "binance",
        name: "Binance Test",
        api_key: "key",
        secret: "secret",
      });
      expect(result.success).toBe(true);
    });

    it("rejects name exceeding 64 chars", async () => {
      const result = await addAccount({
        exchange: "binance",
        name: "A".repeat(65),
        api_key: "key",
        secret: "secret",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("max length");
    });

    it("trims whitespace from credentials", async () => {
      const result = await addAccount({
        exchange: "binance",
        name: "  Binance  ",
        api_key: "  key  ",
        secret: "  secret  ",
      });
      expect(result.success).toBe(true);
      expect(result.account!.name).toBe("Binance");
    });
  });

  describe("listAccounts", () => {
    it("returns empty list initially", async () => {
      const result = await listAccounts();
      expect(result.success).toBe(true);
      expect(result.accounts).toEqual([]);
    });

    it("returns accounts without credentials", async () => {
      await addAccount({ exchange: "binance", name: "B1", api_key: "k", secret: "s" });
      const result = await listAccounts();
      expect(result.accounts).toHaveLength(1);
      // Account should not contain credentials
      const acc = result.accounts[0] as Record<string, unknown>;
      expect(acc.api_key).toBeUndefined();
      expect(acc.secret).toBeUndefined();
    });
  });

  describe("viewAccount", () => {
    it("finds by ID", async () => {
      const created = await addAccount({
        exchange: "binance",
        name: "B1",
        api_key: "mykey123",
        secret: "mysecret",
      });
      const result = await viewAccount(created.account!.id);
      expect(result.success).toBe(true);
      expect(result.masked_credentials!.api_key).toBe("****y123");
      expect(result.masked_credentials!.secret).toBe("****cret");
    });

    it("finds by name", async () => {
      await addAccount({ exchange: "binance", name: "UniqueB", api_key: "key", secret: "secret" });
      const result = await viewAccount("UniqueB");
      expect(result.success).toBe(true);
      expect(result.account!.name).toBe("UniqueB");
    });

    it("errors on ambiguous name", async () => {
      await addAccount({ exchange: "binance", name: "Dup", api_key: "k1", secret: "s1" });
      await addAccount({ exchange: "okx", name: "Dup", api_key: "k2", secret: "s2", passphrase: "p" });
      const result = await viewAccount("Dup");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Multiple accounts");
    });

    it("errors on not found", async () => {
      const result = await viewAccount("nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("updateAccount", () => {
    it("updates name", async () => {
      const created = await addAccount({ exchange: "binance", name: "Old", api_key: "k", secret: "s" });
      const result = await updateAccount(created.account!.id, { name: "New" });
      expect(result.success).toBe(true);
      expect(result.account!.name).toBe("New");
    });

    it("updates credentials", async () => {
      const created = await addAccount({
        exchange: "binance",
        name: "B",
        api_key: "old-key",
        secret: "old-secret",
      });
      await updateAccount(created.account!.id, { api_key: "new-key" });
      const view = await viewAccount(created.account!.id);
      expect(view.masked_credentials!.api_key).toBe("****-key");
    });

    it("refreshes updated_at", async () => {
      const created = await addAccount({ exchange: "binance", name: "B", api_key: "k", secret: "s" });
      // Small delay to ensure different timestamp
      await new Promise((r) => setTimeout(r, 10));
      const result = await updateAccount(created.account!.id, { name: "B2" });
      expect(result.account!.updated_at).not.toBe(created.account!.created_at);
    });

    it("errors on ambiguous name", async () => {
      await addAccount({ exchange: "binance", name: "Same", api_key: "k1", secret: "s1" });
      await addAccount({ exchange: "gate", name: "Same", api_key: "k2", secret: "s2" });
      const result = await updateAccount("Same", { name: "New" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Multiple accounts");
    });
  });

  describe("removeAccount", () => {
    it("removes by ID", async () => {
      const created = await addAccount({ exchange: "binance", name: "B1", api_key: "k", secret: "s" });
      const result = await removeAccount(created.account!.id);
      expect(result.success).toBe(true);
      const list = await listAccounts();
      expect(list.accounts).toHaveLength(0);
    });

    it("removes by name", async () => {
      await addAccount({ exchange: "binance", name: "ToRemove", api_key: "k", secret: "s" });
      const result = await removeAccount("ToRemove");
      expect(result.success).toBe(true);
    });

    it("errors on not found", async () => {
      const result = await removeAccount("nope");
      expect(result.success).toBe(false);
    });

    it("errors on ambiguous name", async () => {
      await addAccount({ exchange: "binance", name: "Dup", api_key: "k1", secret: "s1" });
      await addAccount({ exchange: "gate", name: "Dup", api_key: "k2", secret: "s2" });
      const result = await removeAccount("Dup");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Multiple accounts");
    });
  });

  describe("findAccount", () => {
    it("returns null for no match", async () => {
      const result = await findAccount("nothing");
      expect(result).toBeNull();
    });

    it("prefers ID over name", async () => {
      const created = await addAccount({ exchange: "binance", name: "SomeName", api_key: "k", secret: "s" });
      const result = await findAccount(created.account!.id);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(created.account!.id);
    });
  });
});

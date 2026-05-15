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
      const acc = result.accounts[0] as unknown as Record<string, unknown>;
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

  describe("findAccount edge cases", () => {
    it("returns null for ambiguous name", async () => {
      await addAccount({ exchange: "binance", name: "Same", api_key: "k1", secret: "s1" });
      await addAccount({ exchange: "gate", name: "Same", api_key: "k2", secret: "s2" });
      const result = await findAccount("Same");
      expect(result).toBeNull();
    });
  });

  describe("validation edge cases", () => {
    it("rejects empty name (whitespace only)", async () => {
      const result = await addAccount({
        exchange: "binance",
        name: "   ",
        api_key: "key",
        secret: "secret",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("name");
    });

    it("accepts name at exactly 64 chars", async () => {
      const result = await addAccount({
        exchange: "binance",
        name: "A".repeat(64),
        api_key: "key",
        secret: "secret",
      });
      expect(result.success).toBe(true);
      expect(result.account!.name).toBe("A".repeat(64));
    });

    it("rejects secret exceeding 256 chars", async () => {
      const result = await addAccount({
        exchange: "binance",
        name: "Test",
        api_key: "key",
        secret: "s".repeat(257),
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("max length");
    });

    it("accepts secret at exactly 256 chars", async () => {
      const result = await addAccount({
        exchange: "binance",
        name: "Test",
        api_key: "key",
        secret: "s".repeat(256),
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty secret (whitespace only)", async () => {
      const result = await addAccount({
        exchange: "binance",
        name: "Test",
        api_key: "key",
        secret: "   ",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("secret");
    });
  });

  describe("updateAccount edge cases", () => {
    it("errors on not found", async () => {
      const result = await updateAccount("nonexistent", { name: "New" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("clears passphrase when set to empty string", async () => {
      const created = await addAccount({
        exchange: "okx",
        name: "OKX Test",
        api_key: "key",
        secret: "secret",
        passphrase: "mypass",
      });
      const result = await updateAccount(created.account!.id, { passphrase: "" });
      expect(result.success).toBe(true);
      // View should show no passphrase
      const viewed = await viewAccount(created.account!.id);
      expect(viewed.masked_credentials!.passphrase).toBeUndefined();
    });

    it("rejects name exceeding max length in update", async () => {
      const created = await addAccount({
        exchange: "binance",
        name: "Valid",
        api_key: "key",
        secret: "secret",
      });
      const result = await updateAccount(created.account!.id, { name: "X".repeat(65) });
      expect(result.success).toBe(false);
      expect(result.error).toContain("max length");
    });

    it("rejects invalid credential in update", async () => {
      const created = await addAccount({
        exchange: "binance",
        name: "B",
        api_key: "key",
        secret: "secret",
      });
      const result = await updateAccount(created.account!.id, { api_key: "  " });
      expect(result.success).toBe(false);
      expect(result.error).toContain("api_key");
    });
  });

  describe("addAccount passphrase validation", () => {
    it("rejects passphrase exceeding 256 chars for OKX", async () => {
      const result = await addAccount({
        exchange: "okx",
        name: "Test",
        api_key: "key",
        secret: "secret",
        passphrase: "p".repeat(257),
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("max length");
    });

    it("accepts passphrase at exactly 256 chars", async () => {
      const result = await addAccount({
        exchange: "okx",
        name: "Test",
        api_key: "key",
        secret: "secret",
        passphrase: "p".repeat(256),
      });
      expect(result.success).toBe(true);
    });
  });

  describe("viewAccount credential masking", () => {
    it("shows masked passphrase for OKX account", async () => {
      const created = await addAccount({
        exchange: "okx",
        name: "OKX View Test",
        api_key: "my-api-key-12345",
        secret: "my-secret-12345",
        passphrase: "my-passphrase",
      });
      const result = await viewAccount(created.account!.id);
      expect(result.success).toBe(true);
      expect(result.masked_credentials!.api_key).toBe("****2345");
      expect(result.masked_credentials!.secret).toBe("****2345");
      expect(result.masked_credentials!.passphrase).toBe("****rase");
    });

    it("omits passphrase in masked credentials when not set", async () => {
      const created = await addAccount({
        exchange: "binance",
        name: "Binance View",
        api_key: "binance-key-1234",
        secret: "binance-secret-1234",
      });
      const result = await viewAccount(created.account!.id);
      expect(result.success).toBe(true);
      expect(result.masked_credentials!.api_key).toBeDefined();
      expect(result.masked_credentials!.secret).toBeDefined();
      expect(result.masked_credentials!.passphrase).toBeUndefined();
    });
  });

  describe("updateAccount passphrase", () => {
    it("sets passphrase to a new valid value", async () => {
      const created = await addAccount({
        exchange: "okx",
        name: "OKX Update PP",
        api_key: "key123",
        secret: "secret123",
        passphrase: "old-pass",
      });
      const result = await updateAccount(created.account!.id, { passphrase: "new-passphrase" });
      expect(result.success).toBe(true);
      const viewed = await viewAccount(created.account!.id);
      expect(viewed.masked_credentials!.passphrase).toBe("****rase");
    });
  });

  describe("addAccount additional Minor cases", () => {
    it("rejects api_key exceeding 256 chars", async () => {
      const result = await addAccount({
        exchange: "binance",
        name: "Test",
        api_key: "k".repeat(257),
        secret: "secret",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("max length");
    });

    it("rejects missing passphrase for Bitget", async () => {
      const result = await addAccount({
        exchange: "bitget",
        name: "Test",
        api_key: "key",
        secret: "secret",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("passphrase");
    });

    it("rejects missing passphrase for KuCoin", async () => {
      const result = await addAccount({
        exchange: "kucoin",
        name: "Test",
        api_key: "key",
        secret: "secret",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("passphrase");
    });

    it("allows duplicate names (no uniqueness constraint)", async () => {
      await addAccount({ exchange: "binance", name: "DupName", api_key: "k1", secret: "s1" });
      const result = await addAccount({ exchange: "gate", name: "DupName", api_key: "k2", secret: "s2" });
      expect(result.success).toBe(true);
      const list = await listAccounts();
      expect(list.accounts.filter((a) => a.name === "DupName")).toHaveLength(2);
    });
  });

  describe("updateAccount additional Minor cases", () => {
    it("updates secret with valid value", async () => {
      const created = await addAccount({ exchange: "binance", name: "B", api_key: "key", secret: "old-secret" });
      const result = await updateAccount(created.account!.id, { secret: "new-secret-value" });
      expect(result.success).toBe(true);
      const viewed = await viewAccount(created.account!.id);
      expect(viewed.masked_credentials!.secret).toBe("****alue");
    });

    it("rejects secret exceeding 256 chars in update", async () => {
      const created = await addAccount({ exchange: "binance", name: "B2", api_key: "key", secret: "secret" });
      const result = await updateAccount(created.account!.id, { secret: "s".repeat(257) });
      expect(result.success).toBe(false);
      expect(result.error).toContain("max length");
    });

    it("rejects passphrase exceeding 256 chars in update", async () => {
      const created = await addAccount({ exchange: "okx", name: "O", api_key: "key", secret: "secret", passphrase: "pass" });
      const result = await updateAccount(created.account!.id, { passphrase: "p".repeat(257) });
      expect(result.success).toBe(false);
      expect(result.error).toContain("max length");
    });

    it("finds account by unique name for update", async () => {
      await addAccount({ exchange: "binance", name: "UniqueForUpdate", api_key: "key", secret: "secret" });
      const result = await updateAccount("UniqueForUpdate", { name: "Renamed" });
      expect(result.success).toBe(true);
      expect(result.account!.name).toBe("Renamed");
    });

    it("updates only updated_at when no fields changed", async () => {
      const created = await addAccount({ exchange: "binance", name: "NoChange", api_key: "key", secret: "secret" });
      await new Promise((r) => setTimeout(r, 10));
      const result = await updateAccount(created.account!.id, {});
      expect(result.success).toBe(true);
      expect(result.account!.name).toBe("NoChange");
      expect(result.account!.updated_at).not.toBe(created.account!.created_at);
    });
  });

  describe("findAccount by unique name", () => {
    it("returns account when name matches exactly one", async () => {
      const created = await addAccount({ exchange: "binance", name: "FindByNameOnly", api_key: "k", secret: "s" });
      const result = await findAccount("FindByNameOnly");
      expect(result).not.toBeNull();
      expect(result!.id).toBe(created.account!.id);
      expect(result!.name).toBe("FindByNameOnly");
    });
  });

  describe("addAccount empty/whitespace passphrase for passphrase-requiring exchange", () => {
    it("rejects empty string passphrase for OKX", async () => {
      const result = await addAccount({
        exchange: "okx",
        name: "Test",
        api_key: "key",
        secret: "secret",
        passphrase: "",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("passphrase");
    });

    it("rejects whitespace-only passphrase for OKX", async () => {
      const result = await addAccount({
        exchange: "okx",
        name: "Test",
        api_key: "key",
        secret: "secret",
        passphrase: "   ",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("passphrase");
    });
  });

  describe("updateAccount whitespace-only passphrase", () => {
    it("rejects whitespace-only passphrase in update", async () => {
      const created = await addAccount({
        exchange: "okx",
        name: "OKX WS Test",
        api_key: "key",
        secret: "secret",
        passphrase: "valid-pass",
      });
      expect(created.success).toBe(true);
      const result = await updateAccount(created.account!.id, { passphrase: "   " });
      expect(result.success).toBe(false);
      expect(result.error).toContain("passphrase");
    });
  });

  describe("findAccount ID-vs-name collision", () => {
    it("prefers ID match when another account has the same value as its name", async () => {
      // Create account A and capture its ID
      const createdA = await addAccount({
        exchange: "binance",
        name: "AccountA",
        api_key: "keyA",
        secret: "secretA",
      });
      expect(createdA.success).toBe(true);
      const idA = createdA.account!.id;

      // Create account B whose name is set to account A's ID
      const createdB = await addAccount({
        exchange: "gate",
        name: idA,
        api_key: "keyB",
        secret: "secretB",
      });
      expect(createdB.success).toBe(true);

      // findAccount(idA) should find account A by ID (ID match takes priority)
      const result = await findAccount(idA);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(idA);
      expect(result!.name).toBe("AccountA");
    });
  });
});

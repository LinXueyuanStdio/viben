import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";

vi.mock("../../account", () => ({
  listAccounts: vi.fn(),
  addAccount: vi.fn(),
  viewAccount: vi.fn(),
  updateAccount: vi.fn(),
  removeAccount: vi.fn(),
  testAccount: vi.fn(),
  listExchanges: vi.fn(),
}));

import { registerAccountCommand } from "./account";
import {
  listAccounts,
  addAccount,
  viewAccount,
  updateAccount,
  removeAccount,
  testAccount,
  listExchanges,
} from "../../account";

const mockListAccounts = listAccounts as ReturnType<typeof vi.fn>;
const mockAddAccount = addAccount as ReturnType<typeof vi.fn>;
const mockViewAccount = viewAccount as ReturnType<typeof vi.fn>;
const mockUpdateAccount = updateAccount as ReturnType<typeof vi.fn>;
const mockRemoveAccount = removeAccount as ReturnType<typeof vi.fn>;
const mockTestAccount = testAccount as ReturnType<typeof vi.fn>;
const mockListExchanges = listExchanges as ReturnType<typeof vi.fn>;

describe("CLI account commands", () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerAccountCommand(program);
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  describe("account list", () => {
    it("prints empty message when no accounts", async () => {
      mockListAccounts.mockResolvedValue({ success: true, accounts: [] });

      await program.parseAsync(["node", "test", "account", "list"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No trading accounts")
      );
    });

    it("prints account table", async () => {
      mockListAccounts.mockResolvedValue({
        success: true,
        accounts: [
          { id: "acc-1", exchange: "okx", name: "My OKX" },
          { id: "acc-2", exchange: "binance", name: "My Binance" },
        ],
      });

      await program.parseAsync(["node", "test", "account", "list"]);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("My OKX");
      expect(allOutput).toContain("My Binance");
      expect(allOutput).toContain("Total: 2");
    });

    it("exits with error when operation fails", async () => {
      mockListAccounts.mockResolvedValue({ success: false, error: "disk error", accounts: [] });

      await expect(
        program.parseAsync(["node", "test", "account", "list"])
      ).rejects.toThrow("process.exit");

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("account add", () => {
    it("adds account with all flags", async () => {
      mockAddAccount.mockResolvedValue({
        success: true,
        account: { id: "acc-new", name: "My OKX" },
      });

      await program.parseAsync([
        "node", "test", "account", "add",
        "-e", "okx",
        "--api-key", "k",
        "--secret", "s",
        "--passphrase", "p",
        "-n", "My OKX",
      ]);

      expect(mockAddAccount).toHaveBeenCalledWith({
        exchange: "okx",
        name: "My OKX",
        api_key: "k",
        secret: "s",
        passphrase: "p",
      });
      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Account added");
    });

    it("generates default name if not provided", async () => {
      mockListExchanges.mockReturnValue([
        { id: "okx", name: "OKX" },
        { id: "binance", name: "Binance" },
      ]);
      mockAddAccount.mockResolvedValue({
        success: true,
        account: { id: "acc-new", name: "OKX #1" },
      });

      await program.parseAsync([
        "node", "test", "account", "add",
        "-e", "okx",
        "--api-key", "k",
        "--secret", "s",
      ]);

      expect(mockAddAccount).toHaveBeenCalledWith(
        expect.objectContaining({ name: "OKX #1" })
      );
    });

    it("exits with error when required flags missing", async () => {
      mockListExchanges.mockReturnValue([
        { id: "okx", name: "OKX" },
      ]);

      await expect(
        program.parseAsync(["node", "test", "account", "add"])
      ).rejects.toThrow("process.exit");

      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("account view", () => {
    it("prints account details", async () => {
      mockViewAccount.mockResolvedValue({
        success: true,
        account: {
          id: "acc-1",
          exchange: "okx",
          name: "My OKX",
          created_at: "2026-01-01",
          updated_at: "2026-01-02",
        },
        masked_credentials: { api_key: "abc...xyz", secret: "***" },
      });

      await program.parseAsync(["node", "test", "account", "view", "acc-1"]);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("acc-1");
      expect(allOutput).toContain("My OKX");
      expect(allOutput).toContain("abc...xyz");
    });

    it("exits with error when not found", async () => {
      mockViewAccount.mockResolvedValue({ success: false, error: "not found" });

      await expect(
        program.parseAsync(["node", "test", "account", "view", "no-exist"])
      ).rejects.toThrow("process.exit");

      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("account update", () => {
    it("updates account successfully", async () => {
      mockUpdateAccount.mockResolvedValue({
        success: true,
        account: { id: "acc-1", name: "Renamed" },
      });

      await program.parseAsync([
        "node", "test", "account", "update", "acc-1",
        "-n", "Renamed",
        "--api-key", "newkey",
      ]);

      expect(mockUpdateAccount).toHaveBeenCalledWith("acc-1", {
        name: "Renamed",
        api_key: "newkey",
        secret: undefined,
        passphrase: undefined,
      });
      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Account updated");
    });

    it("exits with error when not found", async () => {
      mockUpdateAccount.mockResolvedValue({ success: false, error: "not found" });

      await expect(
        program.parseAsync(["node", "test", "account", "update", "no-exist", "-n", "X"])
      ).rejects.toThrow("process.exit");

      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("account remove", () => {
    it("removes account successfully", async () => {
      mockRemoveAccount.mockResolvedValue({ success: true });

      await program.parseAsync(["node", "test", "account", "remove", "acc-1"]);

      expect(mockRemoveAccount).toHaveBeenCalledWith("acc-1");
      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Account removed");
    });

    it("exits with error when not found", async () => {
      mockRemoveAccount.mockResolvedValue({ success: false, error: "not found" });

      await expect(
        program.parseAsync(["node", "test", "account", "remove", "no-exist"])
      ).rejects.toThrow("process.exit");

      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("account test", () => {
    it("prints success with latency", async () => {
      mockTestAccount.mockResolvedValue({ success: true, latency_ms: 50 });

      await program.parseAsync(["node", "test", "account", "test", "acc-1"]);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Connection successful");
      expect(allOutput).toContain("50ms");
    });

    it("exits with error on failure", async () => {
      mockTestAccount.mockResolvedValue({ success: false, error: "Invalid key" });

      await expect(
        program.parseAsync(["node", "test", "account", "test", "acc-1"])
      ).rejects.toThrow("process.exit");

      expect(exitSpy).toHaveBeenCalledWith(1);
      const allErrorOutput = consoleErrorSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allErrorOutput).toContain("Invalid key");
    });
  });

  describe("account add - validation error", () => {
    it("exits with error when addAccount returns failure", async () => {
      vi.mocked(listExchanges).mockReturnValue([
        { id: "okx", name: "OKX", fields: ["api_key", "secret", "passphrase"], sign: vi.fn() as any, testConnection: vi.fn() as any },
      ]);
      vi.mocked(addAccount).mockResolvedValue({
        success: false,
        error: "passphrase is required for OKX",
      });
      try {
        await program.parseAsync(["node", "test", "account", "add", "-e", "okx", "--api-key", "k", "--secret", "s"]);
      } catch {}
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorOutput = consoleErrorSpy.mock.calls.flat().join(" ");
      expect(errorOutput).toContain("passphrase");
    });
  });

  describe("account test - failure with latency", () => {
    it("shows error with latency when both present", async () => {
      vi.mocked(testAccount).mockResolvedValue({
        success: false,
        error: "Invalid API key",
        latency_ms: 250,
      });
      try {
        await program.parseAsync(["node", "test", "account", "test", "myaccount"]);
      } catch {}
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorOutput = consoleErrorSpy.mock.calls.flat().join(" ");
      expect(errorOutput).toContain("Invalid API key");
      expect(errorOutput).toContain("250ms");
    });
  });

  describe("account list - unexpected error", () => {
    it("re-throws non-CliError exceptions", async () => {
      vi.mocked(listAccounts).mockRejectedValue(new Error("Unexpected disk error"));
      await expect(
        program.parseAsync(["node", "test", "account", "list"])
      ).rejects.toThrow("Unexpected disk error");
      // process.exit should NOT have been called (non-CliError path)
      expect(exitSpy).not.toHaveBeenCalled();
    });
  });

  describe("account add - default name fallback", () => {
    it("uses exchange ID as name when exchange not in registry", async () => {
      vi.mocked(listExchanges).mockReturnValue([]);
      vi.mocked(addAccount).mockResolvedValue({
        success: true,
        account: { id: "xyz", exchange: "unknown" as any, name: "unknown #1", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
      });
      await program.parseAsync(["node", "test", "account", "add", "-e", "unknown", "--api-key", "k", "--secret", "s"]);
      expect(vi.mocked(addAccount)).toHaveBeenCalledWith(
        expect.objectContaining({ name: "unknown #1" })
      );
    });
  });

  describe("account view - no masked credentials", () => {
    it("prints details without credentials section when masked_credentials is absent", async () => {
      vi.mocked(viewAccount).mockResolvedValue({
        success: true,
        account: { id: "abc", exchange: "binance", name: "B", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
      });
      await program.parseAsync(["node", "test", "account", "view", "abc"]);
      // Should print basic details without crashing
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.flat().join("\n");
      expect(output).toContain("abc");
      expect(output).toContain("binance");
    });
  });

  describe("account update - secret and passphrase flags", () => {
    it("passes --secret and --passphrase to updateAccount", async () => {
      vi.mocked(updateAccount).mockResolvedValue({
        success: true,
        account: { id: "abc", exchange: "okx", name: "OKX", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
      });
      await program.parseAsync(["node", "test", "account", "update", "abc", "--secret", "new-secret", "--passphrase", "new-pass"]);
      expect(vi.mocked(updateAccount)).toHaveBeenCalledWith("abc", {
        name: undefined,
        api_key: undefined,
        secret: "new-secret",
        passphrase: "new-pass",
      });
    });
  });

  describe("account update - no flags at all", () => {
    it("calls updateAccount with all fields undefined when no flags provided", async () => {
      mockUpdateAccount.mockResolvedValue({
        success: true,
        account: { id: "acc-1", exchange: "okx", name: "OKX", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
      });

      await program.parseAsync(["node", "test", "account", "update", "acc-1"]);

      expect(mockUpdateAccount).toHaveBeenCalledWith("acc-1", {
        name: undefined,
        api_key: undefined,
        secret: undefined,
        passphrase: undefined,
      });
      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Account updated");
    });
  });
});

/**
 * User Command Tests
 *
 * Tests for the `viben user` CLI command:
 * - `viben user init <name>` initializes user identity
 * - `viben user get` returns current user
 * - `viben user get --json` returns JSON output
 * - `viben user status` shows user status
 * - Error handling for not initialized, not in workspace
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerUserCommand } from "./user";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { PathLike } from "node:fs";

// Mock fs modules
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

// Helper to create mock for existsSync
function mockExistsSyncFn(fn: (path: string) => boolean) {
  return (path: PathLike) => fn(String(path));
}

// Mock process.cwd
const mockCwd = "/mock/project/path";

describe("viben user command", () => {
  let program: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Create a fresh program for each test
    program = new Command();
    program.option("--json", "Output JSON");
    program.option("--verbose", "Verbose output");
    program.option("--quiet", "Quiet mode");

    // Register the user command
    registerUserCommand(program);

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Mock process.exit to prevent actual exit
    vi.spyOn(process, "exit").mockImplementation(((code?: number | string | null) => {
      throw new Error(`Process exited with code ${code}`);
    }) as never);

    // Mock process.cwd
    vi.spyOn(process, "cwd").mockReturnValue(mockCwd);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Command Registration Tests
  // ==========================================================================

  describe("Command registration", () => {
    it("should register user command with subcommands", () => {
      const userCmd = program.commands.find((cmd) => cmd.name() === "user");
      expect(userCmd).toBeDefined();
      expect(userCmd!.description()).toBe("Manage user identity");
    });

    it("should have init subcommand", () => {
      const userCmd = program.commands.find((cmd) => cmd.name() === "user");
      const initCmd = userCmd!.commands.find((cmd) => cmd.name() === "init");
      expect(initCmd).toBeDefined();
      expect(initCmd!.description()).toBe("Initialize user identity");
    });

    it("should have get subcommand", () => {
      const userCmd = program.commands.find((cmd) => cmd.name() === "user");
      const getCmd = userCmd!.commands.find((cmd) => cmd.name() === "get");
      expect(getCmd).toBeDefined();
      expect(getCmd!.description()).toBe("Get current user identity");
    });

    it("should have status subcommand", () => {
      const userCmd = program.commands.find((cmd) => cmd.name() === "user");
      const statusCmd = userCmd!.commands.find((cmd) => cmd.name() === "status");
      expect(statusCmd).toBeDefined();
      expect(statusCmd!.description()).toBe("Show user status and workspace info");
    });
  });

  // ==========================================================================
  // viben user init Tests
  // ==========================================================================

  describe("viben user init <name>", () => {
    it("should initialize user identity when in workspace", async () => {
      // Mock .viben directory exists at cwd
      vi.mocked(existsSync).mockImplementation(mockExistsSyncFn((path) => {
        if (path === join(mockCwd, ".viben")) return true;
        if (path === join(mockCwd, ".viben", ".developer")) return false;
        if (path.includes("journal-1.md")) return false;
        if (path.includes("index.md")) return false;
        return false;
      }));

      // Mock writeFile and mkdir to succeed
      vi.mocked(writeFile).mockResolvedValue(undefined);
      vi.mocked(mkdir).mockResolvedValue(undefined);

      await program.parseAsync(["node", "viben", "user", "init", "john"]);

      // Verify .developer file was created
      expect(writeFile).toHaveBeenCalledWith(
        join(mockCwd, ".viben", ".developer"),
        expect.stringContaining("name=john"),
        "utf-8"
      );

      // Verify success message
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Developer initialized: john")
      );
    });

    it("should show already initialized message if developer exists", async () => {
      // Mock .viben and .developer exist
      vi.mocked(existsSync).mockImplementation(mockExistsSyncFn((path) => {
        if (path === join(mockCwd, ".viben")) return true;
        if (path === join(mockCwd, ".viben", ".developer")) return true;
        return false;
      }));

      // Mock readFile to return existing developer
      vi.mocked(readFile).mockResolvedValue("name=existing-user\n");

      await program.parseAsync(["node", "viben", "user", "init", "john"]);

      // Should not write new file
      expect(writeFile).not.toHaveBeenCalled();

      // Should show already initialized message
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Developer already initialized: existing-user")
      );
    });

    it("should error when not in a workspace", async () => {
      // Mock no .viben directory anywhere
      vi.mocked(existsSync).mockReturnValue(false);

      await expect(
        program.parseAsync(["node", "viben", "user", "init", "john"])
      ).rejects.toThrow("Process exited");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Not in a Viben workspace")
      );
    });

    it("should output JSON when --json flag is used", async () => {
      // Mock .viben directory exists
      vi.mocked(existsSync).mockImplementation(mockExistsSyncFn((path) => {
        if (path === join(mockCwd, ".viben")) return true;
        if (path === join(mockCwd, ".viben", ".developer")) return false;
        return false;
      }));

      vi.mocked(writeFile).mockResolvedValue(undefined);
      vi.mocked(mkdir).mockResolvedValue(undefined);

      await program.parseAsync(["node", "viben", "user", "init", "john", "--json"]);

      // Find the JSON output call
      const jsonCall = consoleLogSpy.mock.calls.find((call: unknown[]) => {
        try {
          const parsed = JSON.parse(String(call[0]));
          return parsed.success !== undefined;
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
      const output = JSON.parse(String(jsonCall![0]));
      expect(output.success).toBe(true);
      expect(output.data.user).toBe("john");
    });

    it("should create workspace directory and files", async () => {
      vi.mocked(existsSync).mockImplementation(mockExistsSyncFn((path) => {
        if (path === join(mockCwd, ".viben")) return true;
        if (path === join(mockCwd, ".viben", ".developer")) return false;
        return false;
      }));

      vi.mocked(writeFile).mockResolvedValue(undefined);
      vi.mocked(mkdir).mockResolvedValue(undefined);

      await program.parseAsync(["node", "viben", "user", "init", "claude-agent"]);

      // Verify mkdir was called for workspace
      expect(mkdir).toHaveBeenCalledWith(
        join(mockCwd, ".viben", "workspace", "claude-agent"),
        { recursive: true }
      );

      // Verify journal file was created
      expect(writeFile).toHaveBeenCalledWith(
        join(mockCwd, ".viben", "workspace", "claude-agent", "journal-1.md"),
        expect.stringContaining("# Journal - claude-agent"),
        "utf-8"
      );

      // Verify index.md was created
      expect(writeFile).toHaveBeenCalledWith(
        join(mockCwd, ".viben", "workspace", "claude-agent", "index.md"),
        expect.stringContaining("# Workspace Index - claude-agent"),
        "utf-8"
      );
    });
  });

  // ==========================================================================
  // viben user get Tests
  // ==========================================================================

  describe("viben user get", () => {
    it("should return current user name", async () => {
      // Mock .viben and .developer exist
      vi.mocked(existsSync).mockImplementation(mockExistsSyncFn((path) => {
        if (path === join(mockCwd, ".viben")) return true;
        if (path === join(mockCwd, ".viben", ".developer")) return true;
        return false;
      }));

      vi.mocked(readFile).mockResolvedValue("name=john\ninitialized_at=2024-01-01\n");

      await program.parseAsync(["node", "viben", "user", "get"]);

      expect(consoleLogSpy).toHaveBeenCalledWith("john");
    });

    it("should output JSON when --json flag is used", async () => {
      vi.mocked(existsSync).mockImplementation(mockExistsSyncFn((path) => {
        if (path === join(mockCwd, ".viben")) return true;
        if (path === join(mockCwd, ".viben", ".developer")) return true;
        return false;
      }));

      vi.mocked(readFile).mockResolvedValue("name=john\n");

      await program.parseAsync(["node", "viben", "user", "get", "--json"]);

      const jsonCall = consoleLogSpy.mock.calls.find((call: unknown[]) => {
        try {
          const parsed = JSON.parse(String(call[0]));
          return parsed.success !== undefined;
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
      const output = JSON.parse(String(jsonCall![0]));
      expect(output.success).toBe(true);
      expect(output.data.user).toBe("john");
    });

    it("should error when developer not initialized", async () => {
      vi.mocked(existsSync).mockImplementation(mockExistsSyncFn((path) => {
        if (path === join(mockCwd, ".viben")) return true;
        if (path === join(mockCwd, ".viben", ".developer")) return false;
        return false;
      }));

      await expect(
        program.parseAsync(["node", "viben", "user", "get"])
      ).rejects.toThrow("Process exited");

      expect(consoleErrorSpy).toHaveBeenCalledWith("Developer not initialized");
    });

    it("should output null in JSON mode when not initialized", async () => {
      vi.mocked(existsSync).mockImplementation(mockExistsSyncFn((path) => {
        if (path === join(mockCwd, ".viben")) return true;
        if (path === join(mockCwd, ".viben", ".developer")) return false;
        return false;
      }));

      await program.parseAsync(["node", "viben", "user", "get", "--json"]);

      const jsonCall = consoleLogSpy.mock.calls.find((call: unknown[]) => {
        try {
          const parsed = JSON.parse(String(call[0]));
          return parsed.data?.user === null;
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
      const output = JSON.parse(String(jsonCall![0]));
      expect(output.success).toBe(true);
      expect(output.data.user).toBeNull();
    });

    it("should error when not in a workspace", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await expect(
        program.parseAsync(["node", "viben", "user", "get"])
      ).rejects.toThrow("Process exited");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Not in a Viben workspace")
      );
    });
  });

  // ==========================================================================
  // viben user status Tests
  // ==========================================================================

  describe("viben user status", () => {
    it("should show user status when initialized", async () => {
      vi.mocked(existsSync).mockImplementation(mockExistsSyncFn((path) => {
        if (path === join(mockCwd, ".viben")) return true;
        if (path === join(mockCwd, ".viben", ".developer")) return true;
        if (path === join(mockCwd, ".viben", "workspace", "john")) return true;
        return false;
      }));

      vi.mocked(readFile).mockResolvedValue("name=john\n");

      await program.parseAsync(["node", "viben", "user", "status"]);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("User Status"));
    });

    it("should show not initialized message when no developer", async () => {
      vi.mocked(existsSync).mockImplementation(mockExistsSyncFn((path) => {
        if (path === join(mockCwd, ".viben")) return true;
        if (path === join(mockCwd, ".viben", ".developer")) return false;
        return false;
      }));

      await program.parseAsync(["node", "viben", "user", "status"]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Developer not initialized")
      );
    });

    it("should output JSON when --json flag is used", async () => {
      vi.mocked(existsSync).mockImplementation(mockExistsSyncFn((path) => {
        if (path === join(mockCwd, ".viben")) return true;
        if (path === join(mockCwd, ".viben", ".developer")) return true;
        if (path === join(mockCwd, ".viben", "workspace", "john")) return true;
        return false;
      }));

      vi.mocked(readFile).mockResolvedValue("name=john\n");

      await program.parseAsync(["node", "viben", "user", "status", "--json"]);

      const jsonCall = consoleLogSpy.mock.calls.find((call: unknown[]) => {
        try {
          const parsed = JSON.parse(String(call[0]));
          return parsed.data?.initialized !== undefined;
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
      const output = JSON.parse(String(jsonCall![0]));
      expect(output.success).toBe(true);
      expect(output.data.initialized).toBe(true);
      expect(output.data.user).toBe("john");
    });
  });

  // ==========================================================================
  // Workspace Directory Traversal Tests
  // ==========================================================================

  describe("Workspace detection", () => {
    it("should find .viben in parent directory", async () => {
      const nestedCwd = "/mock/project/path/src/components";
      vi.spyOn(process, "cwd").mockReturnValue(nestedCwd);

      // Mock .viben exists only at /mock/project/path
      vi.mocked(existsSync).mockImplementation(mockExistsSyncFn((path) => {
        if (path === "/mock/project/path/.viben") return true;
        if (path === "/mock/project/path/.viben/.developer") return true;
        return false;
      }));

      vi.mocked(readFile).mockResolvedValue("name=john\n");

      await program.parseAsync(["node", "viben", "user", "get"]);

      expect(consoleLogSpy).toHaveBeenCalledWith("john");
    });
  });
});

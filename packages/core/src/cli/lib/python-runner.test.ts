/**
 * Python Runner Utility Tests
 *
 * Tests for the Python script runner utility.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";

// Mock node:child_process
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

// Mock node:fs
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import {
  findVibenRoot,
  getVibenScriptPath,
  runVibenScript,
} from "./python-runner";

describe("Python Runner Utility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // findVibenRoot tests
  // ============================================================================

  describe("findVibenRoot", () => {
    it("should find .viben directory in current directory", () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return String(path).endsWith(".viben");
      });

      const result = findVibenRoot("/workspace/project");

      expect(result).toBe("/workspace/project");
    });

    it("should find .viben directory in parent directory", () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return String(path) === "/workspace/.viben";
      });

      const result = findVibenRoot("/workspace/project/src");

      expect(result).toBe("/workspace");
    });

    it("should return null when .viben not found", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = findVibenRoot("/some/path");

      expect(result).toBe(null);
    });
  });

  // ============================================================================
  // getVibenScriptPath tests
  // ============================================================================

  describe("getVibenScriptPath", () => {
    it("should return correct path to script", () => {
      const result = getVibenScriptPath("/workspace", "get_context.py");

      expect(result).toBe(join("/workspace", ".viben", "scripts", "get_context.py"));
    });

    it("should handle nested script names", () => {
      const result = getVibenScriptPath("/workspace", "common/paths.py");

      expect(result).toBe(join("/workspace", ".viben", "scripts", "common/paths.py"));
    });
  });

  // ============================================================================
  // runVibenScript tests
  // ============================================================================

  describe("runVibenScript", () => {
    it("should return error when not in workspace", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await runVibenScript("get_context.py");

      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Not in a Viben workspace");
    });

    it("should return error when script not found", async () => {
      // First call for findVibenRoot (workspace exists)
      // Second call for script check (script doesn't exist)
      vi.mocked(existsSync).mockImplementation((path) => {
        return String(path).endsWith(".viben");
      });

      const result = await runVibenScript("nonexistent.py");

      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Script not found");
    });

    it("should spawn python process with correct arguments", async () => {
      vi.mocked(existsSync).mockReturnValue(true);

      // Create mock child process
      const mockOn = vi.fn();
      const mockStdout = { on: vi.fn() };
      const mockStderr = { on: vi.fn() };

      vi.mocked(spawn).mockReturnValue({
        stdout: mockStdout,
        stderr: mockStderr,
        on: mockOn,
        kill: vi.fn(),
      } as unknown as ReturnType<typeof spawn>);

      // Start the script (don't await yet)
      const promise = runVibenScript("get_context.py", ["--json"]);

      // Simulate process completion
      const closeHandler = mockOn.mock.calls.find((call) => call[0] === "close")?.[1];
      if (closeHandler) {
        closeHandler(0);
      }

      const result = await promise;

      expect(spawn).toHaveBeenCalledWith(
        expect.stringMatching(/python3?$/),
        expect.arrayContaining(["--json"]),
        expect.objectContaining({
          stdio: ["ignore", "pipe", "pipe"],
        })
      );
    });

    it("should capture stdout from script", async () => {
      vi.mocked(existsSync).mockReturnValue(true);

      const mockOn = vi.fn();
      const mockStdoutOn = vi.fn();
      const mockStderrOn = vi.fn();

      vi.mocked(spawn).mockReturnValue({
        stdout: { on: mockStdoutOn },
        stderr: { on: mockStderrOn },
        on: mockOn,
        kill: vi.fn(),
      } as unknown as ReturnType<typeof spawn>);

      const promise = runVibenScript("get_context.py");

      // Simulate stdout data
      const stdoutHandler = mockStdoutOn.mock.calls.find((call) => call[0] === "data")?.[1];
      if (stdoutHandler) {
        stdoutHandler(Buffer.from("test output"));
      }

      // Simulate process completion
      const closeHandler = mockOn.mock.calls.find((call) => call[0] === "close")?.[1];
      if (closeHandler) {
        closeHandler(0);
      }

      const result = await promise;

      expect(result.stdout).toBe("test output");
      expect(result.code).toBe(0);
    });

    it("should capture stderr from script", async () => {
      vi.mocked(existsSync).mockReturnValue(true);

      const mockOn = vi.fn();
      const mockStdoutOn = vi.fn();
      const mockStderrOn = vi.fn();

      vi.mocked(spawn).mockReturnValue({
        stdout: { on: mockStdoutOn },
        stderr: { on: mockStderrOn },
        on: mockOn,
        kill: vi.fn(),
      } as unknown as ReturnType<typeof spawn>);

      const promise = runVibenScript("get_context.py");

      // Simulate stderr data
      const stderrHandler = mockStderrOn.mock.calls.find((call) => call[0] === "data")?.[1];
      if (stderrHandler) {
        stderrHandler(Buffer.from("error message"));
      }

      // Simulate process completion with error
      const closeHandler = mockOn.mock.calls.find((call) => call[0] === "close")?.[1];
      if (closeHandler) {
        closeHandler(1);
      }

      const result = await promise;

      expect(result.stderr).toBe("error message");
      expect(result.code).toBe(1);
    });

    it("should handle spawn error", async () => {
      vi.mocked(existsSync).mockReturnValue(true);

      const mockOn = vi.fn();

      vi.mocked(spawn).mockReturnValue({
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: mockOn,
        kill: vi.fn(),
      } as unknown as ReturnType<typeof spawn>);

      const promise = runVibenScript("get_context.py");

      // Simulate error event
      const errorHandler = mockOn.mock.calls.find((call) => call[0] === "error")?.[1];
      if (errorHandler) {
        errorHandler(new Error("spawn failed"));
      }

      const result = await promise;

      expect(result.code).toBe(1);
      expect(result.stderr).toBe("spawn failed");
    });

    it("should pass environment variables to script", async () => {
      vi.mocked(existsSync).mockReturnValue(true);

      const mockOn = vi.fn();

      vi.mocked(spawn).mockReturnValue({
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: mockOn,
        kill: vi.fn(),
      } as unknown as ReturnType<typeof spawn>);

      runVibenScript("get_context.py", [], {
        env: { CUSTOM_VAR: "value" },
      });

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            CUSTOM_VAR: "value",
            PYTHONIOENCODING: "utf-8",
          }),
        })
      );
    });
  });
});

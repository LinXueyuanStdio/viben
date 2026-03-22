/**
 * CLI test helpers
 */
import { Command } from "commander";
import { vi } from "vitest";
import { createConsoleSpy, type ConsoleSpy } from "../mocks/console";

export interface CliTestContext {
  program: Command;
  console: ConsoleSpy;
  run: (args: string[]) => Promise<void>;
  runJson: (args: string[]) => Promise<unknown>;
  cleanup: () => void;
}

/**
 * Create a CLI test context with program and console spies
 */
export function createCliTestContext(
  registerCommand: (program: Command) => void
): CliTestContext {
  const program = new Command();
  program.option("--json", "Output in JSON format");
  program.option("--verbose", "Verbose output");
  program.option("--quiet", "Quiet mode");

  registerCommand(program);

  const consoleSpy = createConsoleSpy();

  return {
    program,
    console: consoleSpy,

    async run(args: string[]) {
      await program.parseAsync(["node", "test", ...args]);
    },

    async runJson(args: string[]) {
      await program.parseAsync(["node", "test", "--json", ...args]);
      const lastLog = consoleSpy.getLastLog();
      if (lastLog) {
        return JSON.parse(lastLog);
      }
      return null;
    },

    cleanup() {
      consoleSpy.cleanup();
      vi.clearAllMocks();
    },
  };
}

/**
 * Assert JSON output matches expected structure
 */
export function assertJsonOutput(
  consoleSpy: ConsoleSpy,
  expected: Record<string, unknown>
): void {
  const lastLog = consoleSpy.getLastLog();
  if (!lastLog) {
    throw new Error("No console output captured");
  }
  const output = JSON.parse(lastLog);
  for (const [key, value] of Object.entries(expected)) {
    if (output[key] !== value) {
      throw new Error(
        `Expected ${key} to be ${JSON.stringify(value)}, got ${JSON.stringify(output[key])}`
      );
    }
  }
}

/**
 * Assert success JSON response
 */
export function assertSuccess(consoleSpy: ConsoleSpy): unknown {
  const lastLog = consoleSpy.getLastLog();
  if (!lastLog) {
    throw new Error("No console output captured");
  }
  const output = JSON.parse(lastLog);
  if (!output.success) {
    throw new Error(`Expected success response, got: ${lastLog}`);
  }
  return output;
}

/**
 * Assert error JSON response
 */
export function assertError(
  consoleSpy: ConsoleSpy,
  errorPattern?: string | RegExp
): unknown {
  const lastLog = consoleSpy.getLastLog();
  if (!lastLog) {
    throw new Error("No console output captured");
  }
  const output = JSON.parse(lastLog);
  if (output.success) {
    throw new Error(`Expected error response, got success: ${lastLog}`);
  }
  if (errorPattern) {
    const errorMsg = output.error || "";
    const matches =
      typeof errorPattern === "string"
        ? errorMsg.includes(errorPattern)
        : errorPattern.test(errorMsg);
    if (!matches) {
      throw new Error(
        `Expected error to match ${errorPattern}, got: ${errorMsg}`
      );
    }
  }
  return output;
}

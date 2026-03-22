/**
 * Console spy utilities for tests
 */
import { vi } from "vitest";

export interface ConsoleSpy {
  logs: string[];
  errors: string[];
  warns: string[];
  logSpy: ReturnType<typeof vi.spyOn>;
  errorSpy: ReturnType<typeof vi.spyOn>;
  warnSpy: ReturnType<typeof vi.spyOn>;
  cleanup: () => void;
  reset: () => void;
  getLastLog: () => string | undefined;
  getLastError: () => string | undefined;
  hasLog: (pattern: string | RegExp) => boolean;
  hasError: (pattern: string | RegExp) => boolean;
}

/**
 * Create console spies that capture output
 */
export function createConsoleSpy(): ConsoleSpy {
  const logs: string[] = [];
  const errors: string[] = [];
  const warns: string[] = [];

  const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
    logs.push(args.map(String).join(" "));
  });

  const errorSpy = vi.spyOn(console, "error").mockImplementation((...args) => {
    errors.push(args.map(String).join(" "));
  });

  const warnSpy = vi.spyOn(console, "warn").mockImplementation((...args) => {
    warns.push(args.map(String).join(" "));
  });

  const matchPattern = (text: string, pattern: string | RegExp): boolean => {
    if (typeof pattern === "string") {
      return text.includes(pattern);
    }
    return pattern.test(text);
  };

  return {
    logs,
    errors,
    warns,
    logSpy,
    errorSpy,
    warnSpy,
    cleanup: () => {
      logSpy.mockRestore();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    },
    reset: () => {
      logs.length = 0;
      errors.length = 0;
      warns.length = 0;
    },
    getLastLog: () => logs[logs.length - 1],
    getLastError: () => errors[errors.length - 1],
    hasLog: (pattern) => logs.some((log) => matchPattern(log, pattern)),
    hasError: (pattern) => errors.some((err) => matchPattern(err, pattern)),
  };
}

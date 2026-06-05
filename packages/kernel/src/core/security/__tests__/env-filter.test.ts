import { describe, it, expect } from "vitest";
import { filterEnv, DEFAULT_ENV_WHITELIST } from "../env-filter.js";

describe("filterEnv", () => {
  const mockProcessEnv: Record<string, string> = {
    PATH: "/usr/bin",
    HOME: "/home/user",
    SHELL: "/bin/bash",
    LANG: "en_US.UTF-8",
    LC_ALL: "en_US.UTF-8",
    LC_CTYPE: "UTF-8",
    TERM: "xterm-256color",
    USER: "testuser",
    LOGNAME: "testuser",
    TMPDIR: "/tmp",
    XDG_DATA_HOME: "/home/user/.local/share",
    XDG_CONFIG_HOME: "/home/user/.config",
    NODE_ENV: "development",
    EDITOR: "vim",
    AWS_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    AWS_ACCESS_KEY_ID: "AKIAIOSFODNN7EXAMPLE",
    DATABASE_URL: "postgres://user:pass@host/db",
    OPENAI_API_KEY: "sk-1234567890",
    TELEGRAM_BOT_TOKEN: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    GITHUB_TOKEN: "ghp_xxxxxxxxxxxxxxxxxxxx",
    STRIPE_SECRET_KEY: "sk_test_xxxx",
  };

  it("passes only whitelisted vars with default whitelist", () => {
    const result = filterEnv(mockProcessEnv);
    expect(result.PATH).toBe("/usr/bin");
    expect(result.HOME).toBe("/home/user");
    expect(result.SHELL).toBe("/bin/bash");
    expect(result.LANG).toBe("en_US.UTF-8");
    expect(result.TERM).toBe("xterm-256color");
    expect(result.USER).toBe("testuser");
    expect(result.NODE_ENV).toBe("development");
  });

  it("blocks secret vars", () => {
    const result = filterEnv(mockProcessEnv);
    expect(result.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(result.AWS_ACCESS_KEY_ID).toBeUndefined();
    expect(result.DATABASE_URL).toBeUndefined();
    expect(result.OPENAI_API_KEY).toBeUndefined();
    expect(result.TELEGRAM_BOT_TOKEN).toBeUndefined();
    expect(result.GITHUB_TOKEN).toBeUndefined();
    expect(result.STRIPE_SECRET_KEY).toBeUndefined();
  });

  it("supports glob patterns (LC_* matches LC_ALL, LC_CTYPE)", () => {
    const result = filterEnv(mockProcessEnv);
    expect(result.LC_ALL).toBe("en_US.UTF-8");
    expect(result.LC_CTYPE).toBe("UTF-8");
  });

  it("supports glob patterns (XDG_* matches XDG_DATA_HOME, XDG_CONFIG_HOME)", () => {
    const result = filterEnv(mockProcessEnv);
    expect(result.XDG_DATA_HOME).toBe("/home/user/.local/share");
    expect(result.XDG_CONFIG_HOME).toBe("/home/user/.config");
  });

  it("merges agent env on top of filtered process env", () => {
    const result = filterEnv(mockProcessEnv, { MY_AGENT_VAR: "hello", PATH: "/custom/bin" });
    expect(result.MY_AGENT_VAR).toBe("hello");
    expect(result.PATH).toBe("/custom/bin");
  });

  it("uses custom whitelist when provided", () => {
    const result = filterEnv(mockProcessEnv, undefined, ["PATH", "AWS_ACCESS_KEY_ID"]);
    expect(result.PATH).toBe("/usr/bin");
    expect(result.AWS_ACCESS_KEY_ID).toBe("AKIAIOSFODNN7EXAMPLE");
    expect(result.HOME).toBeUndefined();
  });

  it("returns empty object when process env is empty", () => {
    const result = filterEnv({});
    expect(Object.keys(result).length).toBe(0);
  });

  it("default whitelist is exported and non-empty", () => {
    expect(DEFAULT_ENV_WHITELIST.length).toBeGreaterThan(0);
    expect(DEFAULT_ENV_WHITELIST).toContain("PATH");
    expect(DEFAULT_ENV_WHITELIST).toContain("HOME");
  });
});

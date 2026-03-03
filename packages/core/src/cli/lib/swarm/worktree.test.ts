/**
 * Tests for worktree utilities
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// Mock the fs module
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  writeFileSync: vi.fn(),
  appendFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  unlinkSync: vi.fn(),
  renameSync: vi.fn(),
}));

// Import after mocking
import {
  getWorktreeCopyFiles,
  getWorktreePostCreateHooks,
  parseSimpleYaml,
  getWorktreeConfig,
  getWorktreeBaseDir,
} from "./worktree";

describe("worktree utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("parseSimpleYaml", () => {
    it("should parse key-value pairs", () => {
      const yaml = `
version: 1
worktree_dir: ../worktrees
`;
      const result = parseSimpleYaml(yaml);
      expect(result.version).toBe("1");
      expect(result.worktree_dir).toBe("../worktrees");
    });

    it("should parse lists", () => {
      const yaml = `
copy:
  - .env
  - .env.local
  - .npmrc
`;
      const result = parseSimpleYaml(yaml);
      expect(result.copy).toEqual([".env", ".env.local", ".npmrc"]);
    });

    it("should parse mixed content", () => {
      const yaml = `
version: 1
worktree_dir: ../worktrees
copy:
  - .env
  - .env.local
post_create:
  - pnpm install
  - pnpm build
`;
      const result = parseSimpleYaml(yaml);
      expect(result.version).toBe("1");
      expect(result.worktree_dir).toBe("../worktrees");
      expect(result.copy).toEqual([".env", ".env.local"]);
      expect(result.post_create).toEqual(["pnpm install", "pnpm build"]);
    });

    it("should handle quoted values", () => {
      const yaml = `
key1: "value with spaces"
key2: 'another value'
`;
      const result = parseSimpleYaml(yaml);
      expect(result.key1).toBe("value with spaces");
      expect(result.key2).toBe("another value");
    });

    it("should skip comments", () => {
      const yaml = `
# This is a comment
version: 1
# Another comment
worktree_dir: ../worktrees
`;
      const result = parseSimpleYaml(yaml);
      expect(result.version).toBe("1");
      expect(result.worktree_dir).toBe("../worktrees");
    });

    it("should skip empty lines", () => {
      const yaml = `
version: 1

worktree_dir: ../worktrees

`;
      const result = parseSimpleYaml(yaml);
      expect(result.version).toBe("1");
      expect(result.worktree_dir).toBe("../worktrees");
    });
  });

  describe("getWorktreeConfig", () => {
    it("should return config path", () => {
      const repoRoot = "/path/to/repo";
      const configPath = getWorktreeConfig(repoRoot);
      expect(configPath).toBe("/path/to/repo/.viben/worktree.yaml");
    });
  });

  describe("getWorktreeBaseDir", () => {
    it("should return default when config does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const repoRoot = "/path/to/repo";
      const baseDir = getWorktreeBaseDir(repoRoot);
      expect(baseDir).toBe(path.resolve(repoRoot, "../worktrees"));
    });

    it("should return configured worktree_dir", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(`
version: 1
worktree_dir: ../my-worktrees
`);
      const repoRoot = "/path/to/repo";
      const baseDir = getWorktreeBaseDir(repoRoot);
      expect(baseDir).toBe(path.resolve(repoRoot, "../my-worktrees"));
    });

    it("should handle absolute paths", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(`
version: 1
worktree_dir: /absolute/worktrees
`);
      const repoRoot = "/path/to/repo";
      const baseDir = getWorktreeBaseDir(repoRoot);
      expect(baseDir).toBe("/absolute/worktrees");
    });
  });

  describe("getWorktreeCopyFiles", () => {
    it("should return empty array when config does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const repoRoot = "/path/to/repo";
      const files = getWorktreeCopyFiles(repoRoot);
      expect(files).toEqual([]);
    });

    it("should return copy files list", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(`
copy:
  - .env
  - .env.local
  - .npmrc
`);
      const repoRoot = "/path/to/repo";
      const files = getWorktreeCopyFiles(repoRoot);
      expect(files).toEqual([".env", ".env.local", ".npmrc"]);
    });

    it("should return empty array when copy section is missing", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(`
version: 1
worktree_dir: ../worktrees
`);
      const repoRoot = "/path/to/repo";
      const files = getWorktreeCopyFiles(repoRoot);
      expect(files).toEqual([]);
    });
  });

  describe("getWorktreePostCreateHooks", () => {
    it("should return empty array when config does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const repoRoot = "/path/to/repo";
      const hooks = getWorktreePostCreateHooks(repoRoot);
      expect(hooks).toEqual([]);
    });

    it("should return post_create hooks list", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(`
post_create:
  - pnpm install
  - pnpm build
`);
      const repoRoot = "/path/to/repo";
      const hooks = getWorktreePostCreateHooks(repoRoot);
      expect(hooks).toEqual(["pnpm install", "pnpm build"]);
    });

    it("should return empty array when post_create section is missing", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(`
version: 1
worktree_dir: ../worktrees
`);
      const repoRoot = "/path/to/repo";
      const hooks = getWorktreePostCreateHooks(repoRoot);
      expect(hooks).toEqual([]);
    });
  });

  describe("full worktree.yaml parsing", () => {
    it("should correctly parse a complete config file", () => {
      const configContent = `
version: 1
worktree_dir: ../worktrees
copy:
  - .env
  - .env.local
post_create:
  - pnpm install
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(configContent);

      const repoRoot = "/path/to/repo";

      // Test all functions with the same config
      const baseDir = getWorktreeBaseDir(repoRoot);
      expect(baseDir).toBe(path.resolve(repoRoot, "../worktrees"));

      const copyFiles = getWorktreeCopyFiles(repoRoot);
      expect(copyFiles).toEqual([".env", ".env.local"]);

      const postCreateHooks = getWorktreePostCreateHooks(repoRoot);
      expect(postCreateHooks).toEqual(["pnpm install"]);
    });
  });
});

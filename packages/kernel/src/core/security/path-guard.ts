/**
 * PathGuard — filesystem access control for agent subprocesses.
 *
 * Agents run with the user's filesystem permissions but should NOT access:
 *   - Files outside the workspace directory (prevents system-wide reads/writes)
 *   - Sensitive files within the workspace (env files, keys, credentials)
 *   - The .viben/ directory itself (contains bot tokens and API keys)
 *
 * The guard uses a deny-by-default approach: paths must be within the cwd
 * or explicitly allowlisted, AND must not match any deny pattern. Deny
 * patterns use .gitignore syntax via the `ignore` library.
 *
 * Used by AgentInstance when processing file read/write tool calls from agents.
 */

import fs from "node:fs";
import path from "node:path";
import ignore, { type Ignore } from "ignore";

/**
 * Default deny patterns for sensitive files that agents must never access.
 * Uses .gitignore-style glob syntax.
 */
const DEFAULT_DENY_PATTERNS = [
  // Environment files — contain API keys, database URLs, etc.
  ".env",
  ".env.*",
  // Cryptographic keys
  "*.key",
  "*.pem",
  // SSH and cloud credentials
  ".ssh/",
  ".aws/",
  // Viben workspace — contains bot tokens and secrets
  ".viben/",
  // Generic credential/secret files
  "**/credentials*",
  "**/secrets*",
  "**/*.secret",
];

/** Configuration for PathGuard's access control rules. */
export interface PathGuardOptions {
  /** Workspace root — files must be within this directory (or allowedPaths). */
  cwd: string;
  /** Additional paths allowed outside cwd (e.g. file-service upload dir). */
  allowedPaths: string[];
  /** Additional deny patterns (merged with DEFAULT_DENY_PATTERNS). */
  ignorePatterns: string[];
}

/**
 * Enforces path restrictions on agent file operations.
 *
 * Validates that a target path is within the workspace boundary and does
 * not match any deny pattern. Resolves symlinks to prevent traversal attacks
 * (e.g. symlink pointing outside the workspace).
 */
export class PathGuard {
  private readonly cwd: string;
  private readonly allowedPaths: string[];
  private readonly ig: Ignore;

  constructor(options: PathGuardOptions) {
    // Use realpathSync to resolve symlinks (e.g., /var -> /private/var on macOS)
    try {
      this.cwd = fs.realpathSync(path.resolve(options.cwd));
    } catch {
      this.cwd = path.resolve(options.cwd);
    }
    this.allowedPaths = options.allowedPaths.map((p) => {
      try {
        return fs.realpathSync(path.resolve(p));
      } catch {
        return path.resolve(p);
      }
    });
    this.ig = ignore();
    this.ig.add(DEFAULT_DENY_PATTERNS);
    if (options.ignorePatterns.length > 0) {
      this.ig.add(options.ignorePatterns);
    }
  }

  /**
   * Checks whether an agent is allowed to access the given path.
   *
   * Validation order:
   *   1. Write to .vibenignore is always blocked (prevents agents from weakening their own restrictions)
   *   2. Path must be within cwd or an explicitly allowlisted path
   *   3. If within cwd but not allowlisted, path must not match any deny pattern
   *
   * @param targetPath - The path the agent is attempting to access.
   * @param operation - The operation type. Write operations are subject to stricter
   *   restrictions than reads — specifically, writing to `.vibenignore` is blocked
   *   (to prevent agents from weakening their own restrictions), while reading it is allowed.
   * @returns `{ allowed: true }` or `{ allowed: false, reason: "..." }`
   */
  validatePath(
    targetPath: string,
    operation: "read" | "write",
  ): { allowed: boolean; reason: string } {
    const resolved = path.resolve(targetPath);

    let realPath: string;
    try {
      realPath = fs.realpathSync(resolved);
    } catch {
      realPath = resolved;
    }

    if (operation === "write" && path.basename(realPath) === ".vibenignore") {
      return { allowed: false, reason: "Cannot write to .vibenignore" };
    }

    const isWithinCwd =
      realPath === this.cwd || realPath.startsWith(this.cwd + path.sep);
    const isWithinAllowed = this.allowedPaths.some(
      (ap) => realPath === ap || realPath.startsWith(ap + path.sep),
    );

    if (!isWithinCwd && !isWithinAllowed) {
      return {
        allowed: false,
        reason: `Path is outside workspace boundary: ${realPath}`,
      };
    }

    // allowedPaths explicitly whitelists paths — they override ignore patterns.
    // This lets file-service uploads (e.g. .viben/files/) be readable even
    // though .viben/ is in the default deny list.
    if (isWithinCwd && !isWithinAllowed) {
      const relativePath = path.relative(this.cwd, realPath);
      // Allow .vibenignore reads — it is a config file, not sensitive
      if (relativePath === ".vibenignore") {
        return { allowed: true, reason: "" };
      }
      if (relativePath && this.ig.ignores(relativePath)) {
        return {
          allowed: false,
          reason: `Path matches ignore pattern: ${relativePath}`,
        };
      }
    }

    return { allowed: true, reason: "" };
  }

  /** Adds an additional allowed path at runtime (e.g. for file-service uploads). */
  addAllowedPath(p: string): void {
    try {
      this.allowedPaths.push(fs.realpathSync(path.resolve(p)));
    } catch {
      this.allowedPaths.push(path.resolve(p));
    }
  }

  /**
   * Loads additional deny patterns from .vibenignore in the workspace root.
   * Follows .gitignore syntax — blank lines and lines starting with # are skipped.
   */
  static loadIgnoreFile(cwd: string): string[] {
    const ignorePath = path.join(cwd, ".vibenignore");
    try {
      const content = fs.readFileSync(ignorePath, "utf-8");
      return content
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));
    } catch {
      return [];
    }
  }
}

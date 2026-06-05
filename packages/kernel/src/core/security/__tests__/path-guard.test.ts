import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PathGuard } from "../path-guard.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("PathGuard", () => {
  let tmpDir: string;
  let guard: PathGuard;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pathguard-"));
    fs.writeFileSync(path.join(tmpDir, "allowed.txt"), "ok");
    fs.writeFileSync(path.join(tmpDir, ".env"), "SECRET=123");
    fs.writeFileSync(path.join(tmpDir, "db.key"), "private-key");
    fs.writeFileSync(path.join(tmpDir, "credentials.json"), "{}");
    fs.mkdirSync(path.join(tmpDir, "subdir"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "subdir", "nested.txt"), "nested");
    guard = new PathGuard({ cwd: tmpDir, allowedPaths: [], ignorePatterns: [] });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("allows read of file within cwd", () => {
    const result = guard.validatePath(path.join(tmpDir, "allowed.txt"), "read");
    expect(result.allowed).toBe(true);
  });

  it("allows read of file in nested directory within cwd", () => {
    const result = guard.validatePath(path.join(tmpDir, "subdir", "nested.txt"), "read");
    expect(result.allowed).toBe(true);
  });

  it("rejects read of file outside cwd", () => {
    const result = guard.validatePath("/etc/passwd", "read");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("outside");
  });

  it("rejects read of home directory sensitive file", () => {
    const result = guard.validatePath(path.join(os.homedir(), ".ssh", "id_rsa"), "read");
    expect(result.allowed).toBe(false);
  });

  it("rejects path traversal via ../", () => {
    const result = guard.validatePath(path.join(tmpDir, "..", "..", "etc", "passwd"), "read");
    expect(result.allowed).toBe(false);
  });

  it("rejects write outside cwd", () => {
    const result = guard.validatePath("/tmp/evil.txt", "write");
    expect(result.allowed).toBe(false);
  });

  it("allows read from allowedPaths", () => {
    const extraDir = fs.mkdtempSync(path.join(os.tmpdir(), "allowed-"));
    fs.writeFileSync(path.join(extraDir, "config.txt"), "config");
    const guardWithAllowed = new PathGuard({
      cwd: tmpDir,
      allowedPaths: [extraDir],
      ignorePatterns: [],
    });
    const result = guardWithAllowed.validatePath(path.join(extraDir, "config.txt"), "read");
    expect(result.allowed).toBe(true);
    fs.rmSync(extraDir, { recursive: true, force: true });
  });

  it("rejects symlink pointing outside cwd", () => {
    const outsideFile = path.join(os.tmpdir(), "outside-target-" + Date.now() + ".txt");
    fs.writeFileSync(outsideFile, "secret");
    const symlinkPath = path.join(tmpDir, "evil-link");
    fs.symlinkSync(outsideFile, symlinkPath);
    const result = guard.validatePath(symlinkPath, "read");
    expect(result.allowed).toBe(false);
    fs.unlinkSync(outsideFile);
  });

  it("rejects .env files by default", () => {
    const result = guard.validatePath(path.join(tmpDir, ".env"), "read");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("ignore");
  });

  it("rejects .env.local files by default", () => {
    fs.writeFileSync(path.join(tmpDir, ".env.local"), "x");
    const result = guard.validatePath(path.join(tmpDir, ".env.local"), "read");
    expect(result.allowed).toBe(false);
  });

  it("rejects *.key files by default", () => {
    const result = guard.validatePath(path.join(tmpDir, "db.key"), "read");
    expect(result.allowed).toBe(false);
  });

  it("rejects credentials files by default", () => {
    const result = guard.validatePath(path.join(tmpDir, "credentials.json"), "read");
    expect(result.allowed).toBe(false);
  });

  it("respects custom .vibenignore patterns", () => {
    const guardCustom = new PathGuard({
      cwd: tmpDir,
      allowedPaths: [],
      ignorePatterns: ["*.txt"],
    });
    const result = guardCustom.validatePath(path.join(tmpDir, "allowed.txt"), "read");
    expect(result.allowed).toBe(false);
  });

  it("rejects write to .vibenignore", () => {
    const result = guard.validatePath(path.join(tmpDir, ".vibenignore"), "write");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain(".vibenignore");
  });

  it("allows read of .vibenignore", () => {
    fs.writeFileSync(path.join(tmpDir, ".vibenignore"), "*.log");
    const result = guard.validatePath(path.join(tmpDir, ".vibenignore"), "read");
    expect(result.allowed).toBe(true);
  });

  it("handles cwd path itself", () => {
    const result = guard.validatePath(tmpDir, "read");
    expect(result.allowed).toBe(true);
  });

  it("allowedPaths overrides ignore patterns for paths inside cwd", () => {
    // Simulate file-service uploads saved to <cwd>/.viben/files/
    // .viben/ is in DEFAULT_DENY_PATTERNS but files subdir is whitelisted via addAllowedPath
    const vibenFilesDir = path.join(tmpDir, ".viben", "files");
    fs.mkdirSync(vibenFilesDir, { recursive: true });
    fs.writeFileSync(path.join(vibenFilesDir, "photo.jpg"), "image data");

    // Without allowedPaths: .viben/ should be blocked
    const blocked = guard.validatePath(path.join(vibenFilesDir, "photo.jpg"), "read");
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toContain("ignore");

    // With allowedPaths: explicitly whitelisted subdir overrides the deny pattern
    const guardWithFiles = new PathGuard({
      cwd: tmpDir,
      allowedPaths: [vibenFilesDir],
      ignorePatterns: [],
    });
    const allowed = guardWithFiles.validatePath(path.join(vibenFilesDir, "photo.jpg"), "read");
    expect(allowed.allowed).toBe(true);

    // .viben/ outside the whitelisted subdir should still be blocked
    const secretsDir = path.join(tmpDir, ".viben");
    fs.writeFileSync(path.join(secretsDir, "api-secret"), "topsecret");
    const stillBlocked = guardWithFiles.validatePath(path.join(secretsDir, "api-secret"), "read");
    expect(stillBlocked.allowed).toBe(false);
  });

  it("rejects path that is prefix but not subdirectory", () => {
    const siblingDir = tmpDir + "bar";
    fs.mkdirSync(siblingDir, { recursive: true });
    fs.writeFileSync(path.join(siblingDir, "secret"), "s");
    const result = guard.validatePath(path.join(siblingDir, "secret"), "read");
    expect(result.allowed).toBe(false);
    fs.rmSync(siblingDir, { recursive: true, force: true });
  });
});

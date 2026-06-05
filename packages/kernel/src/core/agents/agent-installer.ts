/**
 * Agent installation and uninstallation logic.
 *
 * Handles three distribution types:
 *  - **npx** — Node package runner (no download, resolved on first use)
 *  - **uvx** — Python package runner (no download, resolved on first use)
 *  - **binary** — pre-built archive downloaded and extracted to `~/.viben/agents/`
 *
 * Binary archives are validated before and after extraction to prevent
 * path traversal attacks and symlink escapes.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import crypto from "node:crypto";
import { createChildLogger } from "../utils/log.js";
import type { InstalledAgent, RegistryAgent, InstallProgress, InstallResult } from "../types.js";
import { getAgentAlias, checkDependencies, checkRuntimeAvailable, getAgentSetup } from "./agent-dependencies.js";
import { AgentStore } from "./agent-store.js";

const log = createChildLogger({ module: "agent-installer" });

const DEFAULT_AGENTS_DIR = path.join(os.homedir(), ".viben", "agents");

export const MAX_DOWNLOAD_SIZE = 500 * 1024 * 1024; // 500MB

/** Verify SHA-256 checksum of a downloaded binary archive. */
export function verifyChecksum(buffer: Buffer, expectedHash: string): void {
  const actualHash = crypto.createHash("sha256").update(buffer).digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error(
      `Integrity check failed: expected ${expectedHash}, got ${actualHash}`,
    );
  }
}

/**
 * Validate archive entries before extraction to prevent path traversal attacks.
 *
 * Rejects entries containing `..` path segments or absolute paths that could
 * write files outside the destination directory.
 */
export function validateArchiveContents(entries: string[], destDir: string): void {
  for (const entry of entries) {
    // Check for path traversal segments, not just substring — avoids false positives
    // on filenames like "setup..sh" or "..config" that are not traversal attacks.
    const segments = entry.split("/");
    if (segments.includes("..")) {
      throw new Error(`Archive contains unsafe path traversal: ${entry}`);
    }
    if (entry.startsWith("/")) {
      throw new Error(`Archive contains unsafe absolute path: ${entry}`);
    }
  }
}

/** @deprecated Use validateArchiveContents instead */
export const validateTarContents = validateArchiveContents;

/** Safety check: refuse to delete paths outside the agents directory during uninstall. */
export function validateUninstallPath(binaryPath: string, agentsDir: string): void {
  const realPath = path.resolve(binaryPath);
  const realAgentsDir = path.resolve(agentsDir);
  if (!realPath.startsWith(realAgentsDir + path.sep) && realPath !== realAgentsDir) {
    throw new Error(`Refusing to delete path outside agents directory: ${realPath}`);
  }
}

// Map Node's os.arch/platform values to the naming convention used by the
// ACP agent registry's binary distribution targets.
const ARCH_MAP: Record<string, string> = {
  arm64: "aarch64",
  x64: "x86_64",
};

const PLATFORM_MAP: Record<string, string> = {
  darwin: "darwin",
  linux: "linux",
  win32: "windows",
};

/** Build a platform-arch key (e.g., "darwin-aarch64") for binary distribution lookup. */
export function getPlatformKey(): string {
  const platform = PLATFORM_MAP[process.platform] ?? process.platform;
  const arch = ARCH_MAP[process.arch] ?? process.arch;
  return `${platform}-${arch}`;
}

export type ResolvedDistribution =
  | { type: "npx"; package: string; args: string[]; env?: Record<string, string> }
  | { type: "uvx"; package: string; args: string[]; env?: Record<string, string> }
  | { type: "binary"; archive: string; cmd: string; args: string[]; env?: Record<string, string> };

/**
 * Determine how to run an agent on this platform.
 *
 * Returns the distribution type (npx/uvx/binary) with all necessary
 * metadata, or null if no distribution exists for the current platform.
 */
export function resolveDistribution(agent: RegistryAgent): ResolvedDistribution | null {
  const dist = agent.distribution;

  if (dist.npx) {
    return { type: "npx", package: dist.npx.package, args: dist.npx.args ?? [], env: dist.npx.env };
  }
  if (dist.uvx) {
    return { type: "uvx", package: dist.uvx.package, args: dist.uvx.args ?? [], env: dist.uvx.env };
  }
  if (dist.binary) {
    const platformKey = getPlatformKey();
    const target = dist.binary[platformKey];
    if (!target) return null;
    return { type: "binary", archive: target.archive, cmd: target.cmd, args: target.args ?? [], env: target.env };
  }
  return null;
}

/**
 * Build an InstalledAgent record from a resolved distribution.
 *
 * For npx/uvx agents, version pins are stripped from the package name so
 * the runner always resolves to the latest version at runtime.
 */
export function buildInstalledAgent(
  registryId: string,
  name: string,
  version: string,
  dist: ResolvedDistribution,
  binaryPath?: string,
): InstalledAgent {
  if (dist.type === "npx") {
    // Use latest version: strip pinned version from package name (e.g. @google/gemini-cli@0.34.0 → @google/gemini-cli)
    const npxPackage = stripPackageVersion(dist.package);
    return {
      registryId, name, version, distribution: "npx",
      command: "npx", args: [npxPackage, ...dist.args],
      env: dist.env ?? {}, installedAt: new Date().toISOString(), binaryPath: null,
    };
  }
  if (dist.type === "uvx") {
    // Strip pinned version: "fast-agent-acp==0.6.6" → "fast-agent-acp", "minion-code@0.1.44" → "minion-code"
    const uvxPackage = stripPythonPackageVersion(dist.package);
    return {
      registryId, name, version, distribution: "uvx",
      command: "uvx", args: [uvxPackage, ...dist.args],
      env: dist.env ?? {}, installedAt: new Date().toISOString(), binaryPath: null,
    };
  }
  // binary
  const absCmd = path.resolve(binaryPath!, dist.cmd);
  return {
    registryId, name, version, distribution: "binary",
    command: absCmd, args: dist.args,
    env: dist.env ?? {}, installedAt: new Date().toISOString(), binaryPath: binaryPath!,
  };
}

/**
 * Strip pinned version from npm package name so npx always uses latest.
 * e.g. "@google/gemini-cli@0.34.0" → "@google/gemini-cli"
 *      "cline@2.9.0" → "cline"
 *      "@scope/pkg" → "@scope/pkg" (no version, unchanged)
 */
function stripPackageVersion(pkg: string): string {
  // Scoped: @scope/name@version → find the second @
  if (pkg.startsWith("@")) {
    const afterScope = pkg.indexOf("/");
    if (afterScope === -1) return pkg;
    const versionAt = pkg.indexOf("@", afterScope + 1);
    return versionAt === -1 ? pkg : pkg.slice(0, versionAt);
  }
  // Unscoped: name@version
  const at = pkg.indexOf("@");
  return at === -1 ? pkg : pkg.slice(0, at);
}

/**
 * Strip pinned version from Python package name so uvx always uses latest.
 * e.g. "fast-agent-acp==0.6.6" → "fast-agent-acp"
 *      "minion-code@0.1.44" → "minion-code"
 *      "crow-cli" → "crow-cli" (no version, unchanged)
 */
function stripPythonPackageVersion(pkg: string): string {
  // Python-style: name==version or name>=version
  const pyMatch = pkg.match(/^([^=@><!]+)/);
  if (pyMatch && pkg.includes("==")) return pyMatch[1]!;
  // npm-style @ used in some uvx packages
  const at = pkg.indexOf("@");
  return at === -1 ? pkg : pkg.slice(0, at);
}

/**
 * Install an agent from the registry.
 *
 * Steps:
 *  1. Resolve distribution type for the current platform
 *  2. Check runtime availability (uvx/npx must exist)
 *  3. Check external CLI dependencies (non-blocking — surfaced as setup steps)
 *  4. Download and extract binary archives (binary type only)
 *  5. Save to the agent store
 *  6. Return setup instructions for post-install configuration
 */
export async function installAgent(
  agent: RegistryAgent,
  store: AgentStore,
  progress?: InstallProgress,
  agentsDir?: string,
): Promise<InstallResult> {
  const agentKey = getAgentAlias(agent.id);
  await progress?.onStart(agent.id, agent.name);

  // 1. Resolve distribution
  const dist = resolveDistribution(agent);
  if (!dist) {
    const platformKey = getPlatformKey();
    const msg = `${agent.name} is not available for your system (${platformKey}). Check their website for other install options.`;
    await progress?.onError(msg);
    return { ok: false, agentKey, error: msg };
  }

  // 2. Check runtime availability (hard requirement — uvx/npx must exist to run)
  if (dist.type === "uvx" && !checkRuntimeAvailable("uvx")) {
    const msg = `${agent.name} requires Python's uvx tool.\nInstall it with: pip install uv`;
    await progress?.onError(msg, "pip install uv");
    return { ok: false, agentKey, error: msg, hint: "pip install uv" };
  }

  // 3. Check external CLI dependencies (non-blocking — install proceeds, setup steps
  //    guide the user to install required CLIs afterward)
  const depResult = checkDependencies(agent.id);

  // 4. Install based on distribution type
  let binaryPath: string | undefined;

  if (dist.type === "binary") {
    try {
      binaryPath = await downloadAndExtract(agent.id, dist.archive, progress, agentsDir);
    } catch (err) {
      const msg = `Failed to download ${agent.name}. Please try again or install manually.`;
      await progress?.onError(msg);
      return { ok: false, agentKey, error: msg };
    }
  } else {
    await progress?.onStep("Setting up... (will download on first use)");
  }

  // 5. Save to store
  const installed = buildInstalledAgent(agent.id, agent.name, agent.version, dist, binaryPath);
  store.addAgent(agentKey, installed);

  // 6. Build setup steps: prefer agent-specific steps; fall back to dep install hints
  const setup = getAgentSetup(agent.id);
  const setupSteps = setup?.setupSteps ?? (
    depResult.missing?.map((m) => `${m.label}: ${m.installHint}`) ?? []
  );

  await progress?.onSuccess(agent.name);
  return { ok: true, agentKey, setupSteps: setupSteps.length > 0 ? setupSteps : undefined };
}

async function downloadAndExtract(
  agentId: string,
  archiveUrl: string,
  progress?: InstallProgress,
  agentsDir?: string,
): Promise<string> {
  const destDir = path.join(agentsDir ?? DEFAULT_AGENTS_DIR, agentId);
  fs.mkdirSync(destDir, { recursive: true });

  await progress?.onStep("Downloading...");
  log.info({ agentId, url: archiveUrl }, "Downloading agent binary");

  const response = await fetch(archiveUrl);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  const buffer = await readResponseWithProgress(response, contentLength, progress);

  await progress?.onStep("Extracting...");

  if (archiveUrl.endsWith(".zip")) {
    await extractZip(buffer, destDir);
  } else {
    await extractTarGz(buffer, destDir);
  }

  await progress?.onStep("Ready!");
  return destDir;
}

/**
 * Read a fetch response body with download progress reporting and size limit enforcement.
 *
 * Streams chunks incrementally to avoid buffering the entire response
 * in memory before checking the size.
 */
export async function readResponseWithProgress(
  response: Response,
  contentLength: number,
  progress?: InstallProgress,
): Promise<Buffer> {
  if (!response.body) {
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (received > MAX_DOWNLOAD_SIZE) {
      throw new Error(`Download exceeds size limit of ${MAX_DOWNLOAD_SIZE} bytes`);
    }
    if (contentLength > 0) {
      await progress?.onDownloadProgress(Math.round((received / contentLength) * 100));
    }
  }

  return Buffer.concat(chunks);
}

/**
 * Post-extraction safety check: verify all extracted files resolve within
 * the destination directory. Catches symlink-based escapes that wouldn't
 * be detected by pre-extraction path validation alone.
 */
function validateExtractedPaths(destDir: string): void {
  const realDest = fs.realpathSync(destDir);
  const entries = fs.readdirSync(destDir, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    // Node <20.12 uses `path`, >=20.12 uses `parentPath` on Dirent with recursive readdir
    const dirent = entry as fs.Dirent & { parentPath?: string; path?: string };
    const parentPath = dirent.parentPath ?? dirent.path ?? destDir;
    const fullPath = path.join(parentPath, entry.name);
    let realPath: string;
    try {
      realPath = fs.realpathSync(fullPath);
    } catch {
      // Broken symlink — check where it points
      const linkTarget = fs.readlinkSync(fullPath);
      realPath = path.resolve(path.dirname(fullPath), linkTarget);
    }
    if (!realPath.startsWith(realDest + path.sep) && realPath !== realDest) {
      fs.rmSync(destDir, { recursive: true, force: true });
      throw new Error(`Archive contains unsafe path: ${entry.name}`);
    }
  }
}

async function extractTarGz(buffer: Buffer, destDir: string): Promise<void> {
  const { execFileSync } = await import("node:child_process");
  const tmpFile = path.join(destDir, "_archive.tar.gz");
  fs.writeFileSync(tmpFile, buffer);
  try {
    // Validate contents BEFORE extraction
    const listing = execFileSync("tar", ["tf", tmpFile], { stdio: "pipe" })
      .toString().trim().split("\n").filter(Boolean);
    validateArchiveContents(listing, destDir);
    // Safe to extract
    execFileSync("tar", ["xzf", tmpFile, "-C", destDir], { stdio: "pipe" });
  } finally {
    fs.unlinkSync(tmpFile);
  }
  validateExtractedPaths(destDir);
}

async function extractZip(buffer: Buffer, destDir: string): Promise<void> {
  const { execFileSync } = await import("node:child_process");
  const tmpFile = path.join(destDir, "_archive.zip");
  fs.writeFileSync(tmpFile, buffer);
  try {
    // Validate contents BEFORE extraction
    const listing = execFileSync("unzip", ["-l", tmpFile], { stdio: "pipe" })
      .toString().trim().split("\n").filter(Boolean);
    // unzip -l output has header/footer lines; file paths are in the 4th column
    const entries = listing
      .slice(3, -2) // skip header (3 lines) and footer (2 lines)
      .map((line) => line.trim().split(/\s+/).slice(3).join(" "))
      .filter(Boolean);
    validateArchiveContents(entries, destDir);
    // Safe to extract
    execFileSync("unzip", ["-o", tmpFile, "-d", destDir], { stdio: "pipe" });
  } finally {
    fs.unlinkSync(tmpFile);
  }
  validateExtractedPaths(destDir);
}

/** Remove an agent from the store and delete its binary directory if present. */
export async function uninstallAgent(
  agentKey: string,
  store: AgentStore,
  agentsDir?: string,
): Promise<void> {
  const agent = store.getAgent(agentKey);
  if (!agent) return;

  if (agent.binaryPath && fs.existsSync(agent.binaryPath)) {
    validateUninstallPath(agent.binaryPath, agentsDir ?? DEFAULT_AGENTS_DIR);
    fs.rmSync(agent.binaryPath, { recursive: true, force: true });
    log.info({ agentKey, binaryPath: agent.binaryPath }, "Deleted agent binary");
  }

  store.removeAgent(agentKey);
}

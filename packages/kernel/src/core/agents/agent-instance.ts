/**
 * AgentInstance — the ACP Client implementation that manages an agent subprocess.
 *
 * This is the lowest-level boundary between Viben and an external AI agent.
 * It spawns the agent as a child process, communicates over stdin/stdout using
 * the Agent Client Protocol (newline-delimited JSON), and translates ACP events
 * into the internal `AgentEvent` union consumed by Session and adapters.
 *
 * Lifecycle: spawn → ACP initialize → newSession/loadSession → prompt ↔ events → destroy
 *
 * Session wraps AgentInstance to add prompt queuing, auto-naming, and
 * permission gating. This module should NOT be used directly by adapters.
 */

import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { Transform } from "node:stream";
import fs from "node:fs";
import path from "node:path";
import { ClientSideConnection, ndJsonStream } from "@agentclientprotocol/sdk";
import { PathGuard } from "../security/path-guard.js";
import { filterEnv } from "../security/env-filter.js";
import type {
  Agent,
  Client,
  PromptResponse,
  PermissionOption as SdkPermissionOption,
} from "@agentclientprotocol/sdk";
import { nodeToWebWritable, nodeToWebReadable } from "../utils/streams.js";
import { StderrCapture } from "../utils/stderr-capture.js";
import { TypedEmitter } from "../utils/typed-emitter.js";
import type {
  AgentDefinition,
  AgentEvent,
  Attachment,
  ConfigOption,
  McpServerConfig,
  PermissionRequest,
  SetConfigOptionValue,
} from "../types.js";
import { readTextFileWithRange } from "../utils/read-text-file.js";
import { SUPPORTED_IMAGE_MIMES, buildAttachmentNote } from "./attachment-blocks.js";
import type { MiddlewareChain } from "../plugin/middleware-chain.js";
import { PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { TerminalManager } from "../sessions/terminal-manager.js";
import { McpManager } from "./mcp-manager.js";
import type {
  ListSessionsResponse,
  LoadSessionResponse,
  ForkSessionResponse,
  SetSessionConfigOptionResponse,
} from "@agentclientprotocol/sdk";
import { createDebugTracer, type DebugTracer } from "../utils/debug-tracer.js";
import { createChildLogger } from "../utils/log.js";
import { Hook, SessionEv } from "../events.js";
const log = createChildLogger({ module: "agent-instance" });

/**
 * Find the nearest ancestor directory containing package.json.
 *
 * Used by `resolveAgentCommand` to locate node_modules from the package's
 * own install location, which differs between tsc output (`dist/core/`)
 * and tsup bundles (`dist/`).
 */
function findPackageRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return startDir;
}

function commandForWindowsScript(filePath: string): { command: string; args: string[] } {
  const ext = path.extname(filePath).toLowerCase();
  if (process.platform === "win32" && (ext === ".cmd" || ext === ".bat")) {
    return { command: process.env.ComSpec ?? "cmd.exe", args: ["/d", "/s", "/c", `"${filePath}"`] };
  }
  return { command: filePath, args: [] };
}

/**
 * Resolve an agent command name to a directly executable form.
 *
 * Agent commands (e.g. "claude-agent-acp") are npm package names, not native
 * binaries. This function locates the actual JS entry point and runs it via
 * `node` directly, avoiding npm shell wrappers that break subprocess stdio
 * piping (the ACP protocol relies on clean stdin/stdout streams).
 *
 * Resolution order:
 *  1. node_modules/<package>/dist/index.js (direct entry point)
 *  2. node_modules/.bin/<cmd> (parse shebang or shell wrapper to find JS target)
 *  3. System PATH via `which`
 *  4. Special handling for npx/uvx: derive from the running Node's bin directory
 *  5. Fallback: use command as-is
 */
function resolveAgentCommand(cmd: string): { command: string; args: string[] } {
  // Directories to search for node_modules: cwd AND the package's own directory
  const searchRoots = [process.cwd()];
  // Add the directory where this package is installed (for global installs)
  // Use findPackageRoot instead of hardcoded "../.." to handle both tsc (dist/core/)
  // and tsup bundle (dist/) directory structures correctly
  const ownDir = findPackageRoot(import.meta.dirname);
  if (ownDir !== process.cwd()) {
    searchRoots.push(ownDir);
  }

  // 1. Check node_modules for the package's actual JS entry point
  for (const root of searchRoots) {
    const packageDirs = [
      path.resolve(root, "node_modules", "@zed-industries", cmd, "dist", "index.js"),
      path.resolve(root, "node_modules", cmd, "dist", "index.js"),
    ];
    for (const jsPath of packageDirs) {
      if (fs.existsSync(jsPath)) {
        return { command: process.execPath, args: [jsPath] };
      }
    }
  }

  // 2. Check .bin — if it's a JS file with shebang, run with node directly
  for (const root of searchRoots) {
    const localBin = path.resolve(root, "node_modules", ".bin", cmd);
    if (fs.existsSync(localBin)) {
      const content = fs.readFileSync(localBin, "utf-8");
      if (content.startsWith("#!/usr/bin/env node")) {
        return { command: process.execPath, args: [localBin] };
      }
      // Shell wrapper — try to find the target JS file
      const match = content.match(/"([^"]+\.js)"/);
      if (match) {
        const target = path.resolve(path.dirname(localBin), match[1]);
        if (fs.existsSync(target)) {
          return { command: process.execPath, args: [target] };
        }
      }
    }
  }

  // 3. For npx/uvx: derive from the running Node's bin directory.
  //    When viben is installed globally (e.g. via Homebrew or nvm), npx lives
  //    next to the same node binary that is executing this process.  The user's
  //    shell PATH may not include that directory (common with nvm in non-interactive
  //    shells), so resolve it explicitly. On Windows, prefer .cmd/.exe wrappers;
  //    extensionless shim files cannot be spawned reliably by CreateProcess.
  if (cmd === "npx" || cmd === "uvx") {
    const seen = new Set<string>();
    const candidates: string[] = [];
    const addCandidate = (dir: string) => {
      if (!seen.has(dir)) { seen.add(dir); candidates.push(dir); }
    };

    addCandidate(path.dirname(process.execPath));
    try { addCandidate(path.dirname(fs.realpathSync(process.execPath))); } catch { /* ignore */ }
    addCandidate("/opt/homebrew/bin");
    addCandidate("/usr/local/bin");

    const executableNames = process.platform === "win32" ? [`${cmd}.cmd`, `${cmd}.exe`, cmd] : [cmd];
    for (const dir of candidates) {
      if (cmd === "npx") {
        // npm layout differs by platform:
        //   Windows (nvm-windows): {bindir}/node_modules/npm/bin/npx-cli.js
        //   macOS/Linux:           {noderoot}/lib/node_modules/npm/bin/npx-cli.js  (bindir is {noderoot}/bin)
        const npxCliCandidates = [
          path.join(dir, "node_modules", "npm", "bin", "npx-cli.js"),
          path.join(path.dirname(dir), "lib", "node_modules", "npm", "bin", "npx-cli.js"),
        ];
        for (const npxCli of npxCliCandidates) {
          if (fs.existsSync(npxCli)) {
            log.info({ cmd, resolved: npxCli }, "Resolved npx CLI from Node installation");
            return { command: process.execPath, args: [npxCli] };
          }
        }
      }
      for (const name of executableNames) {
        const candidate = path.join(dir, name);
        if (fs.existsSync(candidate)) {
          const resolved = commandForWindowsScript(candidate);
          log.info({ cmd, resolved: candidate }, "Resolved package runner from fallback search");
          return resolved;
        }
      }
    }
    log.warn({ cmd, execPath: process.execPath, candidates }, "Could not find package runner in candidate directories");
  }

  // 4. Try resolving from PATH using which
  try {
    const fullPath = execFileSync("which", [cmd], { encoding: "utf-8" }).trim();
    // On Windows, which may return an extensionless shim that CreateProcess cannot spawn directly.
    // Skip it and let the fallback handle it via commandForWindowsScript.
    const isUnspawnableWindowsShim =
      process.platform === "win32" && (cmd === "npx" || cmd === "uvx") && !path.extname(fullPath);
    if (fullPath && !isUnspawnableWindowsShim) {
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        if (content.startsWith("#!/usr/bin/env node")) {
          return { command: process.execPath, args: [fullPath] };
        }
      } catch {
        // Binary file (not readable as utf-8) — use full path directly
      }
      // Found via PATH but not a node script — use the resolved full path
      return commandForWindowsScript(fullPath);
    }
  } catch {
    // which failed — command not on PATH
  }

  // 5. Fallback: use command as-is
  return { command: cmd, args: [] };
}

// TerminalState has been extracted to TerminalManager

// Local types for ACP session update shapes not fully typed by the SDK.
// The SDK uses a generic `update` object; these interfaces provide type safety
// for fields we access when converting ACP events to internal AgentEvent types.
interface SdkToolCallFields {
  rawInput?: unknown;
  rawOutput?: unknown;
  _meta?: Record<string, unknown>;
}

interface SdkSessionInfoUpdate {
  sessionUpdate: 'session_info_update';
  title?: string | null;
  updatedAt?: string | null;
  _meta?: Record<string, unknown>;
}

interface SdkConfigOptionUpdate {
  sessionUpdate: 'config_option_update';
  configOptions: unknown[];
  _meta?: Record<string, unknown>;
}


interface SdkUserMessageChunk {
  sessionUpdate: 'user_message_chunk';
  content: { type: string; text?: string };
}

interface SdkReadTextFileParams {
  path: string;
  line?: number;
  limit?: number;
}

/** Events emitted by AgentInstance — consumed by Session to relay to adapters. */
export interface AgentInstanceEvents {
  agent_event: (event: AgentEvent) => void;
}

/**
 * Manages an ACP agent subprocess and implements the ACP Client interface.
 *
 * Each AgentInstance owns exactly one child process. It handles:
 * - Subprocess spawning with filtered environment and path guarding
 * - ACP protocol handshake (initialize → newSession/loadSession)
 * - Translating ACP session updates into internal AgentEvent types
 * - File I/O and terminal operations requested by the agent
 * - Permission request proxying (agent → Session → adapter → user → agent)
 * - Graceful shutdown (SIGTERM with SIGKILL fallback)
 *
 * Session wraps this class to add prompt queuing and lifecycle management.
 */
export class AgentInstance extends TypedEmitter<AgentInstanceEvents> {
  private connection!: ClientSideConnection;
  private child!: ChildProcess;
  private stderrCapture!: StderrCapture;
  /** Manages terminal subprocesses that agents can spawn for shell commands. */
  private terminalManager = new TerminalManager();
  /** Shared across all instances — resolves MCP server configs for ACP sessions. */
  private static mcpManager = new McpManager();
  /** Guards against emitting crash events during intentional shutdown. */
  private _destroying = false;
  /** Restricts agent file I/O to the workspace directory and explicitly allowed paths. */
  private pathGuard!: PathGuard;

  sessionId!: string;
  agentName: string;
  promptCapabilities?: { image?: boolean; audio?: boolean };
  agentCapabilities?: import("../types.js").AgentCapabilities;
  /** Preserved from newSession/resumeSession response for ACP state propagation */
  initialSessionResponse?: { modes?: unknown; configOptions?: unknown; models?: unknown };
  middlewareChain?: MiddlewareChain;
  debugTracer: DebugTracer | null = null;

  /**
   * Whitelist an additional filesystem path for agent read access.
   *
   * Called by SessionFactory to allow agents to read files outside the
   * workspace (e.g., the file-service upload directory for attachments).
   */
  addAllowedPath(p: string): void {
    this.pathGuard.addAllowedPath(p);
  }

  // Callback — set by Session/Core when wiring events. Returns the selected
  // permission option ID. Default no-op auto-selects the first option.
  onPermissionRequest: (request: PermissionRequest) => Promise<string> =
    async () => "";

  private constructor(agentName: string) {
    super();
    this.agentName = agentName;
  }

  /**
   * Spawn the agent child process and complete the ACP protocol handshake.
   *
   * Steps:
   *  1. Resolve the agent command to a directly executable path
   *  2. Create a PathGuard scoped to the working directory
   *  3. Spawn the subprocess with a filtered environment (security: only whitelisted
   *     env vars are passed to prevent leaking secrets like API keys)
   *  4. Wire stdin/stdout through debug-tracing Transform streams
   *  5. Convert Node streams → Web streams for the ACP SDK
   *  6. Perform the ACP `initialize` handshake and negotiate capabilities
   *
   * Does NOT create a session — callers must follow up with newSession or loadSession.
   */
  public static async spawnSubprocess(
    agentDef: AgentDefinition,
    workingDirectory: string,
    allowedPaths: string[] = [],
  ): Promise<AgentInstance> {
    const instance = new AgentInstance(agentDef.name);
    const resolved = resolveAgentCommand(agentDef.command);
    log.debug(
      {
        agentName: agentDef.name,
        command: resolved.command,
        args: resolved.args,
      },
      "Resolved agent command",
    );

    const ignorePatterns = PathGuard.loadIgnoreFile(workingDirectory);
    instance.pathGuard = new PathGuard({
      cwd: workingDirectory,
      allowedPaths,
      ignorePatterns,
    });

    instance.child = spawn(
      resolved.command,
      [...resolved.args, ...agentDef.args],
      {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: workingDirectory,
        // envWhitelist from workspace.security.envWhitelist config would extend DEFAULT_ENV_WHITELIST.
        // Tracked as follow-up: pass workspace security config through spawn/resume call chain.
        env: filterEnv(process.env as Record<string, string>, agentDef.env),
      },
    );

    await new Promise<void>((resolve, reject) => {
      instance.child.on("error", (err) => {
        reject(
          new Error(
            `Failed to spawn agent "${agentDef.name}": ${err.message}. Is "${agentDef.command}" installed?`,
          ),
        );
      });
      instance.child.on("spawn", () => resolve());
    });

    // Capture last 50 stderr lines for crash diagnostics — stderr is NOT part of
    // the ACP protocol (which uses stdout), but agents log errors/warnings there.
    instance.stderrCapture = new StderrCapture(50);
    instance.child.stderr!.on("data", (chunk: Buffer) => {
      instance.stderrCapture.append(chunk.toString());
    });

    // stdin/stdout pass-through transforms for ACP protocol tracing.
    // When debugTracer is active, each ndjson message is logged with direction
    // (send/recv) for protocol-level debugging. The transforms are transparent
    // when tracing is off — they pass chunks through without modification.
    const stdinLogger = new Transform({
      transform(chunk, _enc, cb) {
        if (instance.debugTracer) {
          const raw = chunk.toString().trimEnd();
          try {
            instance.debugTracer.log("acp", { dir: "send", data: JSON.parse(raw) });
          } catch {
            instance.debugTracer.log("acp", { dir: "send", data: raw });
          }
        }
        cb(null, chunk);
      },
    });
    stdinLogger.pipe(instance.child.stdin!);

    const stdoutLogger = new Transform({
      transform(chunk, _enc, cb) {
        if (instance.debugTracer) {
          const raw = chunk.toString().trimEnd();
          try {
            instance.debugTracer.log("acp", { dir: "recv", data: JSON.parse(raw) });
          } catch {
            instance.debugTracer.log("acp", { dir: "recv", data: raw });
          }
        }
        cb(null, chunk);
      },
    });
    instance.child.stdout!.pipe(stdoutLogger);

    // Bridge Node streams → Web Streams API for the ACP SDK, which uses
    // ReadableStream/WritableStream internally for ndjson parsing.
    const toAgent = nodeToWebWritable(stdinLogger);
    const fromAgent = nodeToWebReadable(stdoutLogger);
    const stream = ndJsonStream(toAgent, fromAgent);

    // ClientSideConnection is the ACP SDK's client. It sends JSON-RPC requests
    // and routes incoming notifications to the Client callbacks (createClient).
    instance.connection = new ClientSideConnection(
      (_agent: Agent): Client => instance.createClient(_agent),
      stream,
    );

    // ACP handshake: negotiate protocol version and declare client capabilities.
    // The agent responds with its own capabilities (image/audio support, etc.).
    const initResponse = await instance.connection.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true,
      },
    });

    if (initResponse.protocolVersion !== PROTOCOL_VERSION) {
      log.warn(
        { expected: PROTOCOL_VERSION, got: initResponse.protocolVersion },
        "ACP protocol version mismatch — some features may not work correctly",
      );
    }

    instance.promptCapabilities =
      initResponse.agentCapabilities?.promptCapabilities;

    // Store full agent capabilities for introspection (session list, fork, close, etc.)
    instance.agentCapabilities = initResponse.agentCapabilities as import("../types.js").AgentCapabilities | undefined;

    log.info(
      { promptCapabilities: instance.promptCapabilities ?? {} },
      "Agent prompt capabilities",
    );

    return instance;
  }

  /**
   * Monitor the subprocess for unexpected exits and emit error events.
   *
   * Distinguishes intentional shutdown (SIGTERM/SIGINT during destroy) from
   * crashes (non-zero exit code or unexpected signal). Crash events include
   * captured stderr output for diagnostic context.
   */
  private setupCrashDetection(): void {
    this.child.on("exit", (code, signal) => {
      if (this._destroying) return;
      log.info(
        { sessionId: this.sessionId, exitCode: code, signal },
        "Agent process exited",
      );
      // SIGINT/SIGTERM are graceful shutdown signals — not crashes
      if (signal === "SIGINT" || signal === "SIGTERM") return;
      if ((code !== 0 && code !== null) || signal) {
        const stderr = this.stderrCapture.getLastLines();
        this.emit(SessionEv.AGENT_EVENT, {
          type: "error",
          message: signal
            ? `Agent killed by signal ${signal}\n${stderr}`
            : `Agent crashed (exit code ${code})\n${stderr}`,
        });
      }
    });

    this.connection.closed.then(() => {
      log.debug({ sessionId: this.sessionId }, "ACP connection closed");
    });
  }

  /** True if the subprocess has exited or been killed. */
  get isDead(): boolean {
    return this.child.killed || this.child.exitCode !== null;
  }

  /**
   * Open a fresh ACP session on a pre-initialized AgentInstance.
   *
   * Pre-conditions:
   *  - The instance has been through `spawnSubprocess` (subprocess is running,
   *    ACP `initialize` handshake is done, `agentCapabilities` is set).
   *  - `sessionId` is unset — calling twice is a programming error.
   *
   * Post-conditions on success:
   *  - `sessionId`, `initialSessionResponse`, and `debugTracer` are populated.
   *  - `setupCrashDetection` is wired so subsequent process exits emit
   *    `AGENT_EVENT` with an error message.
   *  - The instance is fully ready for `prompt()` calls.
   *
   * @throws Error("AgentInstance already has a session — cannot claim twice")
   *         if `sessionId` is already set.
   * @throws Whatever the agent's `newSession` RPC throws (timeout, ACP error,
   *         subprocess exited mid-call). The instance is NOT destroyed in this
   *         case — the caller is responsible for cleanup.
   *
   * Called by:
   *  - `AgentManager.spawn()` when a warm instance is consumed (only path
   *    where `spawnSubprocess` and `claimForSession` are split apart).
   *  - `AgentInstance.spawn()` as the second half of the normal spawn path.
   */
  async claimForSession(workingDirectory: string, mcpServers?: McpServerConfig[], timeoutMs?: number): Promise<void> {
    if (this.sessionId) {
      throw new Error("AgentInstance already has a session — cannot claim twice");
    }
    const resolvedMcp = AgentInstance.mcpManager.resolve(mcpServers);
    const response = await withAgentTimeout(
      this.connection.newSession({ cwd: workingDirectory, mcpServers: resolvedMcp as any }),
      this.agentName,
      'newSession',
      timeoutMs,
    );
    this.sessionId = response.sessionId;
    this.initialSessionResponse = response;
    this.debugTracer = createDebugTracer(response.sessionId, workingDirectory);
    this.setupCrashDetection();
  }

  /**
   * Spawn a new agent subprocess and create a fresh ACP session.
   *
   * This is the primary entry point for starting an agent. It spawns the
   * subprocess, completes the ACP handshake, and calls `newSession` to
   * initialize the agent's working context (cwd, MCP servers).
   *
   * @param agentDef - Agent definition (command, args, env) from the catalog
   * @param workingDirectory - Workspace root the agent operates in
   * @param mcpServers - Optional MCP server configs to extend agent capabilities
   * @param allowedPaths - Extra filesystem paths the agent may access
   */
  static async spawn(
    agentDef: AgentDefinition,
    workingDirectory: string,
    mcpServers?: McpServerConfig[],
    allowedPaths?: string[],
  ): Promise<AgentInstance> {
    log.debug({ agentName: agentDef.name, command: agentDef.command }, "Spawning agent");
    const spawnStart = Date.now();

    const instance = await AgentInstance.spawnSubprocess(agentDef, workingDirectory, allowedPaths);
    await instance.claimForSession(workingDirectory, mcpServers, agentDef.initTimeoutMs);

    log.info(
      {
        sessionId: instance.sessionId,
        durationMs: Date.now() - spawnStart,
        configOptions: (instance.initialSessionResponse as any)?.configOptions ?? [],
        agentCapabilities: instance.agentCapabilities ?? null,
      },
      "Agent spawn complete",
    );
    return instance;
  }

  /**
   * Spawn a new subprocess and restore an existing agent session.
   *
   * Tries loadSession first (preferred, stable API), falls back to the
   * unstable resumeSession, and finally falls back to creating a brand-new
   * session if resume fails entirely (e.g., agent lost its state).
   *
   * @param agentSessionId - The agent-side session ID to restore
   */
  static async resume(
    agentDef: AgentDefinition,
    workingDirectory: string,
    agentSessionId: string,
    mcpServers?: McpServerConfig[],
    allowedPaths?: string[],
  ): Promise<AgentInstance> {
    log.debug({ agentName: agentDef.name, agentSessionId }, "Resuming agent");
    const spawnStart = Date.now();

    const instance = await AgentInstance.spawnSubprocess(
      agentDef,
      workingDirectory,
      allowedPaths,
    );

    const resolvedMcp = AgentInstance.mcpManager.resolve(mcpServers);

    try {
      if (instance.agentCapabilities?.loadSession) {
        // Agent supports session/load — preferred over unstable session/resume
        const response = await withAgentTimeout(
          instance.connection.loadSession({ sessionId: agentSessionId, cwd: workingDirectory, mcpServers: resolvedMcp as any }),
          agentDef.name,
          'loadSession',
          agentDef.initTimeoutMs,
        );
        instance.sessionId = agentSessionId;
        instance.initialSessionResponse = response;
        instance.debugTracer = createDebugTracer(agentSessionId, workingDirectory);
        log.info(
          {
            sessionId: agentSessionId,
            durationMs: Date.now() - spawnStart,
            agentCapabilities: instance.agentCapabilities ?? null,
          },
          "Agent load complete",
        );
      } else {
        const response = await withAgentTimeout(
          instance.connection.unstable_resumeSession({ sessionId: agentSessionId, cwd: workingDirectory }),
          agentDef.name,
          'resumeSession',
          agentDef.initTimeoutMs,
        );
        instance.sessionId = response.sessionId;
        instance.initialSessionResponse = response;
        instance.debugTracer = createDebugTracer(response.sessionId, workingDirectory);
        log.info(
          {
            sessionId: response.sessionId,
            durationMs: Date.now() - spawnStart,
            agentCapabilities: instance.agentCapabilities ?? null,
          },
          "Agent resume complete",
        );
      }
    } catch (err) {
      log.warn(
        { err, agentSessionId },
        "Resume failed, falling back to new session",
      );
      const response = await withAgentTimeout(
        instance.connection.newSession({ cwd: workingDirectory, mcpServers: resolvedMcp as any }),
        agentDef.name,
        'newSession (fallback)',
        agentDef.initTimeoutMs,
      );
      instance.sessionId = response.sessionId;
      instance.initialSessionResponse = response;
      instance.debugTracer = createDebugTracer(response.sessionId, workingDirectory);
      log.info(
        { sessionId: response.sessionId, durationMs: Date.now() - spawnStart },
        "Agent fallback spawn complete",
      );
    }

    instance.setupCrashDetection();
    return instance;
  }

  /**
   * Build the ACP Client callback object.
   *
   * The ACP SDK invokes these callbacks when the agent sends notifications
   * or requests. Each callback maps an ACP protocol message to either:
   * - An internal AgentEvent (emitted for Session/adapters to consume)
   * - A filesystem or terminal operation (executed on the agent's behalf)
   * - A permission request (proxied to the user via the adapter)
   */
  private createClient(_agent: Agent): Client {
    const self = this;
    const MAX_OUTPUT_BYTES = 1024 * 1024; // 1MB cap

    return {
      // ── Session updates ──────────────────────────────────────────────────
      // The agent streams its response as a series of session update events.
      // Each event type maps to an internal AgentEvent that Session relays
      // to adapters for rendering (text chunks, tool calls, usage stats, etc.).
      // Chunks are forwarded to Session individually as they arrive — no buffering
      // happens at this layer. If buffering is needed (e.g., to avoid rate limits),
      // it is the responsibility of the Session or adapter layer.
      async sessionUpdate(params) {
        const update = params.update;
        let event: AgentEvent | null = null;

        switch (update.sessionUpdate) {
          case "agent_message_chunk":
            if (update.content.type === "text") {
              event = { type: "text", content: update.content.text };
            } else if (update.content.type === "image") {
              // ACP SDK types don't expose data/mimeType fields for image content
              const c = update.content as unknown as { data: string; mimeType: string };
              event = { type: "image_content", data: c.data, mimeType: c.mimeType };
            } else if (update.content.type === "audio") {
              // ACP SDK types don't expose data/mimeType fields for audio content
              const c = update.content as unknown as { data: string; mimeType: string };
              event = { type: "audio_content", data: c.data, mimeType: c.mimeType };
            } else if (update.content.type === "resource") {
              // EmbeddedResource: content.resource is TextResourceContents or BlobResourceContents
              // TextResourceContents has { uri, text, mimeType? }
              // BlobResourceContents has { uri, blob, mimeType? }
              const c = update.content as unknown as {
                resource: { uri: string; text?: string; blob?: string; mimeType?: string };
                annotations?: { audience?: string[]; priority?: number };
              };
              // The EmbeddedResource content block doesn't carry a top-level name field —
              // use the uri as a fallback name since AgentEvent.resource_content requires one.
              event = {
                type: "resource_content",
                uri: c.resource.uri,
                name: c.resource.uri,
                text: c.resource.text ?? undefined,
                blob: c.resource.blob ?? undefined,
                mimeType: c.resource.mimeType ?? undefined,
              };
            } else if (update.content.type === "resource_link") {
              // ResourceLink: { uri, name, mimeType?, title?, description?, size? }
              const c = update.content as unknown as {
                uri: string;
                name: string;
                mimeType?: string | null;
                title?: string | null;
                description?: string | null;
                size?: number | null;
              };
              event = {
                type: "resource_link",
                uri: c.uri,
                name: c.name,
                mimeType: c.mimeType ?? undefined,
                title: c.title ?? undefined,
                description: c.description ?? undefined,
                size: c.size ?? undefined,
              };
            }
            break;
          case "agent_thought_chunk":
            if (update.content.type === "text") {
              event = { type: "thought", content: update.content.text };
            }
            break;
          case "tool_call": {
            const tc = update as unknown as SdkToolCallFields;
            event = {
              type: "tool_call",
              id: update.toolCallId,
              name: update.title,
              kind: update.kind ?? undefined,
              status: update.status ?? "pending",
              content: update.content ?? undefined,
              rawInput: tc.rawInput ?? undefined,
              rawOutput: tc.rawOutput ?? undefined,
              meta: tc._meta ?? undefined,
            };
            break;
          }
          case "tool_call_update": {
            const tcu = update as unknown as SdkToolCallFields;
            event = {
              type: "tool_update",
              id: update.toolCallId,
              name: update.title ?? undefined,
              kind: update.kind ?? undefined,
              status: update.status ?? "pending",
              content: update.content ?? undefined,
              rawInput: tcu.rawInput ?? undefined,
              rawOutput: tcu.rawOutput ?? undefined,
              meta: tcu._meta ?? undefined,
            };
            break;
          }
          case "plan":
            event = { type: "plan", entries: update.entries };
            break;
          case "usage_update":
            event = {
              type: "usage",
              tokensUsed: update.used,
              contextSize: update.size,
              cost: update.cost ?? undefined,
            };
            break;
          case "available_commands_update":
            event = {
              type: "commands_update",
              commands: update.availableCommands,
            };
            break;
          case "session_info_update": {
            const si = update as unknown as SdkSessionInfoUpdate;
            event = {
              type: "session_info_update",
              title: si.title ?? undefined,
              updatedAt: si.updatedAt ?? undefined,
              _meta: si._meta ?? undefined,
            };
            break;
          }
          case "config_option_update": {
            const co = update as unknown as SdkConfigOptionUpdate;
            event = {
              type: "config_option_update",
              options: (co.configOptions ?? []) as ConfigOption[],
            };
            break;
          }
          case "user_message_chunk": {
            const um = update as unknown as SdkUserMessageChunk;
            event = {
              type: "user_message_chunk",
              content: um.content?.text ?? "",
            };
            break;
          }
          // NOTE: model_update is NOT a session update type in the ACP SDK schema.
          // Model changes are applied via setSessionConfigOption() and the response
          // is synchronous — the SDK does not push a model_update notification to
          // the client. Therefore AgentEvent "model_update" cannot originate from
          // sessionUpdate and must be emitted by callers of setConfigOption()
          // if they need to propagate the change downstream.
          default:
            // Unknown update type — ignore
            return;
        }

        if (event !== null) {
          self.emit(SessionEv.AGENT_EVENT, event);
        }
      },

      // ── Permission requests ──────────────────────────────────────────────
      // The agent needs user approval before performing sensitive operations
      // (e.g., file writes, shell commands). This proxies the request up
      // through Session → PermissionGate → adapter → user, then returns
      // the user's chosen option ID back to the agent.
      async requestPermission(params) {
        const permissionRequest: PermissionRequest = {
          id: params.toolCall.toolCallId,
          description: params.toolCall.title ?? params.toolCall.toolCallId,
          options: params.options.map((opt: SdkPermissionOption) => ({
            id: opt.optionId,
            label: opt.name,
            isAllow: opt.kind === "allow_once" || opt.kind === "allow_always",
          })),
        };

        const selectedOptionId =
          await self.onPermissionRequest(permissionRequest);
        return {
          outcome: { outcome: "selected" as const, optionId: selectedOptionId },
        };
      },

      // ── File operations ──────────────────────────────────────────────────
      // The agent reads/writes files through these callbacks rather than
      // accessing the filesystem directly. This allows PathGuard to enforce
      // workspace boundaries and middleware hooks to intercept I/O.
      async readTextFile(params) {
        const p = params as unknown as SdkReadTextFileParams;
        // Security: validate path against workspace boundary
        const pathCheck = self.pathGuard.validatePath(p.path, "read");
        if (!pathCheck.allowed) {
          throw new Error(`[Access denied] ${pathCheck.reason}`);
        }
        // Hook: fs:beforeRead — modifiable, can block
        if (self.middlewareChain) {
          const result = await self.middlewareChain.execute(Hook.FS_BEFORE_READ, { sessionId: self.sessionId, path: p.path, line: p.line, limit: p.limit }, async (r) => r);
          if (!result) return { content: "" }; // blocked by middleware
          p.path = result.path;
        }
        const content = await readTextFileWithRange(p.path, {
          line: p.line ?? undefined,
          limit: p.limit ?? undefined,
        });
        return { content };
      },

      async writeTextFile(params) {
        let writePath = params.path;
        let writeContent = params.content;
        // Security: validate path against workspace boundary
        const pathCheck = self.pathGuard.validatePath(writePath, "write");
        if (!pathCheck.allowed) {
          throw new Error(`[Access denied] ${pathCheck.reason}`);
        }
        // Hook: fs:beforeWrite — modifiable, can block
        if (self.middlewareChain) {
          const result = await self.middlewareChain.execute(Hook.FS_BEFORE_WRITE, { sessionId: self.sessionId, path: writePath, content: writeContent }, async (r) => r);
          if (!result) return {}; // blocked by middleware
          writePath = result.path;
          writeContent = result.content;
        }
        await fs.promises.mkdir(path.dirname(writePath), { recursive: true });
        await fs.promises.writeFile(writePath, writeContent, "utf-8");
        return {};
      },

      // ── Terminal operations (delegated to TerminalManager) ─────────────
      // Agents can spawn shell commands via terminal operations. TerminalManager
      // handles subprocess lifecycle, output capture, and byte-limit enforcement.
      async createTerminal(params) {
        return self.terminalManager.createTerminal(
          self.sessionId,
          {
            command: params.command,
            args: params.args,
            env: params.env,
            cwd: params.cwd,
            outputByteLimit: params.outputByteLimit ?? MAX_OUTPUT_BYTES,
          },
          self.middlewareChain,
        );
      },

      async terminalOutput(params) {
        return self.terminalManager.getOutput(params.terminalId);
      },

      async waitForTerminalExit(params) {
        return self.terminalManager.waitForExit(params.terminalId);
      },

      async killTerminal(params) {
        self.terminalManager.kill(params.terminalId);
        return {};
      },

      async releaseTerminal(params) {
        self.terminalManager.release(params.terminalId);
      },
    };
  }

  // ── New ACP methods ──────────────────────────────────────────────────

  /**
   * Update a session config option (mode, model, etc.) on the agent.
   *
   * Falls back to legacy `setSessionMode`/`unstable_setSessionModel` methods
   * for agents that haven't adopted the unified `session/set_config_option`
   * ACP method (detected via JSON-RPC -32601 "Method Not Found" error).
   */
  async setConfigOption(
    configId: string,
    value: SetConfigOptionValue,
  ): Promise<SetSessionConfigOptionResponse> {
    try {
      return await this.connection.setSessionConfigOption({
        sessionId: this.sessionId,
        configId,
        ...value,
      } as any);
    } catch (err) {
      // Fall back to legacy setSessionMode / unstable_setSessionModel for agents
      // (e.g. Gemini CLI) that implement the old separate methods instead of the
      // unified session/set_config_option method (ACP -32601 Method Not Found).
      if (typeof err === 'object' && err !== null && (err as any).code === -32601) {
        if (configId === 'mode' && value.type === 'select') {
          await this.connection.setSessionMode({
            sessionId: this.sessionId,
            modeId: value.value as string,
          });
          return { configOptions: [] };
        }
        if (configId === 'model' && value.type === 'select') {
          await this.connection.unstable_setSessionModel({
            sessionId: this.sessionId,
            modelId: value.value as string,
          });
          return { configOptions: [] };
        }
      }
      throw err;
    }
  }

  /** List the agent's known sessions, optionally filtered by working directory. */
  async listSessions(
    cwd?: string,
    cursor?: string,
  ): Promise<ListSessionsResponse> {
    return await this.connection.listSessions({
      cwd: cwd ?? null,
      cursor: cursor ?? null,
    });
  }

  /** Load an existing agent session by ID into this subprocess. */
  async loadSession(
    sessionId: string,
    cwd: string,
    mcpServers?: McpServerConfig[],
  ): Promise<LoadSessionResponse> {
    const resolvedMcp = AgentInstance.mcpManager.resolve(mcpServers);
    return await this.connection.loadSession({
      sessionId,
      cwd,
      mcpServers: resolvedMcp as any,
    });
  }

  /** Trigger agent-managed authentication (e.g., OAuth flow). */
  async authenticate(methodId: string): Promise<void> {
    await this.connection.authenticate({ methodId });
  }

  /** Fork an existing session, creating a new branch with shared history. */
  async forkSession(
    sessionId: string,
    cwd: string,
    mcpServers?: McpServerConfig[],
  ): Promise<ForkSessionResponse> {
    const resolvedMcp = AgentInstance.mcpManager.resolve(mcpServers);
    return await this.connection.unstable_forkSession({
      sessionId,
      cwd,
      mcpServers: resolvedMcp as any,
    });
  }

  /** Close a session on the agent side (cleanup agent-internal state). */
  async closeSession(sessionId: string): Promise<void> {
    await this.connection.unstable_closeSession({ sessionId });
  }

  // ── Prompt & lifecycle ──────────────────────────────────────────────

  /**
   * Send a user prompt to the agent and wait for the complete response.
   *
   * Builds ACP content blocks from the text and any attachments (images
   * are base64-encoded if the agent supports them, otherwise appended as
   * file paths). The promise resolves when the agent finishes responding;
   * streaming events arrive via the `agent_event` emitter during execution.
   *
   * Attachments that exceed size limits or use unsupported formats are
   * skipped with a note appended to the prompt text.
   *
   * Call `cancel()` to interrupt a running prompt; the agent will stop and
   * the promise resolves with partial results.
   */
  async prompt(text: string, attachments?: Attachment[]): Promise<PromptResponse> {
    const contentBlocks: Array<Record<string, unknown>> = [{ type: "text", text }];
    const capabilities = this.promptCapabilities ?? {};

    for (const att of attachments ?? []) {
      // Check if this attachment should be skipped (too large, unsupported format)
      const skipNote = buildAttachmentNote(att, capabilities);
      if (skipNote !== null) {
        (contentBlocks[0] as { text: string }).text += `\n\n${skipNote}`;
        continue;
      }

      if (att.type === "image" && capabilities.image && SUPPORTED_IMAGE_MIMES.has(att.mimeType)) {
        const attCheck = this.pathGuard.validatePath(att.filePath, "read");
        if (!attCheck.allowed) {
          (contentBlocks[0] as { text: string }).text += `\n\n[Attachment access denied: ${attCheck.reason}]`;
          continue;
        }
        const data = await fs.promises.readFile(att.filePath);
        contentBlocks.push({ type: "image", data: data.toString("base64"), mimeType: att.mimeType });
      } else if (att.type === "audio" && capabilities.audio) {
        const attCheck = this.pathGuard.validatePath(att.filePath, "read");
        if (!attCheck.allowed) {
          (contentBlocks[0] as { text: string }).text += `\n\n[Attachment access denied: ${attCheck.reason}]`;
          continue;
        }
        const data = await fs.promises.readFile(att.filePath);
        contentBlocks.push({ type: "audio", data: data.toString("base64"), mimeType: att.mimeType });
      } else {
        // Fallback: append file path to text so agent can read from disk
        if (att.type === "image" || att.type === "audio") {
          log.debug(
            { type: att.type, capabilities },
            "Agent does not support %s content, falling back to file path",
            att.type,
          );
        }
        (contentBlocks[0] as { text: string }).text += `\n\n[Attached file: ${att.filePath}]`;
      }
    }

    return this.connection.prompt({
      sessionId: this.sessionId,
      prompt: contentBlocks as any,
    });
  }

  /** Cancel the currently running prompt. The agent should stop and return partial results. */
  async cancel(): Promise<void> {
    await this.connection.cancel({ sessionId: this.sessionId });
  }

  /**
   * Gracefully shut down the agent subprocess.
   *
   * Sends SIGTERM first, giving the agent up to 10 seconds to clean up.
   * If the process hasn't exited by then, SIGKILL forces termination.
   * The timer is unref'd so it doesn't keep the Node process alive
   * during shutdown.
   */
  async destroy(): Promise<void> {
    this._destroying = true;

    this.terminalManager.destroyAll();

    if (this.child.exitCode !== null) return;

    await new Promise<void>((resolve) => {
      // Register exit listener BEFORE sending signal to avoid race
      this.child.on("exit", () => {
        clearTimeout(forceKillTimer);
        resolve();
      });

      this.child.kill("SIGTERM");

      const forceKillTimer = setTimeout(() => {
        // Use exitCode check — child.killed is true after ANY kill() call,
        // even if the process hasn't actually exited yet
        if (this.child.exitCode === null) this.child.kill("SIGKILL");
        resolve();
      }, 10_000);
      if (typeof forceKillTimer === 'object' && forceKillTimer !== null && 'unref' in forceKillTimer) {
        (forceKillTimer as NodeJS.Timeout).unref();
      }
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const AGENT_INIT_TIMEOUT_MS = 30_000;

/**
 * Wraps an ACP handshake call (newSession / loadSession / resumeSession) with
 * a timeout so a non-responsive agent process fails fast instead of hanging
 * the HTTP request and blocking a server thread indefinitely.
 */
function withAgentTimeout<T>(promise: Promise<T>, agentName: string, op: string, timeoutMs?: number): Promise<T> {
  const timeout = timeoutMs ?? AGENT_INIT_TIMEOUT_MS;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(
        `Agent "${agentName}" did not respond to ${op} within ${timeout / 1000}s. ` +
        `The agent process may have hung during initialization.`
      ));
    }, timeout);

    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

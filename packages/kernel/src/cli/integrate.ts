import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, chmodSync, rmdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { getAgentCapabilities, commandExists, listAgentsWithIntegration } from "../core/agents/agent-dependencies.js";
import type {
  AgentIntegrationSpec,
  AgentHooksIntegrationSpec,
  AgentPluginIntegrationSpec,
} from "../core/agents/agent-dependencies.js";

/** Result of an install/uninstall operation with a human-readable log. */
export interface IntegrationResult {
  success: boolean;
  /** Log lines describing what was created, updated, or removed. */
  logs: string[];
}

/**
 * A single installable integration component (e.g., handoff scripts, tunnel skill).
 * Each integration consists of one or more items installed/uninstalled independently.
 */
export interface IntegrationItem {
  id: string;
  name: string;
  description: string;
  isInstalled(): boolean;
  install(): Promise<IntegrationResult>;
  uninstall(): Promise<IntegrationResult>;
}

/** All integration items for a specific agent. */
export interface AgentIntegration {
  items: IntegrationItem[];
}

// The filename used to detect whether the inject hook is already installed in an agent's
// hook event. Checked before adding to prevent duplicate entries across re-runs.
const HOOK_MARKER = "viben-inject-session.sh";

function isPluginIntegrationSpec(spec: AgentIntegrationSpec): spec is AgentPluginIntegrationSpec {
  return spec.strategy === "plugin";
}

function isHooksIntegrationSpec(spec: AgentIntegrationSpec): spec is AgentHooksIntegrationSpec {
  return spec.strategy === "hooks";
}

function expandPath(p: string): string {
  return p.replace(/^~/, homedir());
}

// --- Script generators ---

/**
 * Generate the session inject hook script for a hooks-based agent integration.
 *
 * The inject script runs before each agent prompt. It reads the ACP session ID and CWD
 * from the agent's hook input (JSON or plaintext), then outputs them as context variables
 * that the agent can pass to `viben adopt` via the handoff command.
 *
 * Uses `jq` for JSON parsing; falls back to `~/.viben/bin/jq` if not on PATH.
 */
function generateInjectScript(_agentKey: string, spec: AgentHooksIntegrationSpec): string {
  const sidVar = spec.sessionIdVar ?? "SESSION_ID";
  const cwdVar = spec.workingDirVar ?? "WORKING_DIR";

  // Resolve jq: check ~/.viben/bin first, then PATH
  const jqResolver = `JQ=$(command -v jq 2>/dev/null || echo "$HOME/.viben/bin/jq")`;

  if (spec.outputFormat === "plaintext") {
    return `#!/bin/bash
${jqResolver}
INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | "$JQ" -r '${spec.sessionIdField}')
CWD=$(echo "$INPUT" | "$JQ" -r '.cwd')

echo "${sidVar}: $SESSION_ID"
echo "${cwdVar}: $CWD"

exit 0
`;
  }

  // JSON output (Gemini, Cline, Cursor)
  return `#!/bin/bash
${jqResolver}
INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | "$JQ" -r '${spec.sessionIdField}')
CWD=$(echo "$INPUT" | "$JQ" -r '.cwd')

"$JQ" -n --arg sid "$SESSION_ID" --arg cwd "$CWD" \\
  '{"additionalContext":"${sidVar}: \\($sid)\\n${cwdVar}: \\($cwd)"}'

exit 0
`;
}

/**
 * Generate the handoff shell script that the agent calls to transfer the session.
 * Wraps `viben adopt <agent> <session_id>` with optional --cwd and --channel flags.
 */
function generateHandoffScript(agentKey: string): string {
  return `#!/bin/bash
SESSION_ID=$1
CWD=$2
CHANNEL=$3

if [ -z "$SESSION_ID" ]; then
  echo "Usage: viben-handoff.sh <session_id> [cwd] [channel]"
  exit 1
fi

viben adopt ${agentKey} "$SESSION_ID" \${CWD:+--cwd "$CWD"} \${CHANNEL:+--channel "$CHANNEL"}
`;
}

/**
 * Generate the tunnel skill markdown file.
 * This is a slash command / skill description that tells the AI agent when and how
 * to use `viben tunnel` commands to expose local ports.
 */
function generateTunnelCommand(): string {
  return `---
description: Expose local ports to the internet. Use when user wants to share, preview, or access their local dev server remotely. Triggers on phrases like "expose port", "map port", "share my app", "make it public", "open tunnel", "public URL", "share localhost", "preview on phone", "access from outside", "forward port", "ngrok", "cloudflare tunnel", etc.
---

You have access to Viben tunnel management via CLI. This creates a public URL for any local port (dev servers, APIs, static sites, etc.) using Cloudflare tunnel.

## Commands

\`\`\`bash
# Create a tunnel — exposes local port to the internet
viben tunnel add <port> --label <name>

# List all active tunnels with their public URLs
viben tunnel list

# Stop a specific tunnel
viben tunnel stop <port>

# Stop all tunnels
viben tunnel stop-all
\`\`\`

## When to use

User wants to:
- **Share their local app** — "share this on my phone", "let my friend see this", "preview on mobile"
- **Expose a port** — "expose port 3000", "map port 5173", "make port 8080 public"
- **Get a public URL** — "give me a public URL", "I need an external link", "make localhost accessible"
- **Open a tunnel** — "open tunnel", "start tunnel", "tunnel this"
- **Forward/proxy a port** — "forward port 3000", "proxy my server"
- **Deploy preview** — "deploy preview", "share a preview link"
- **Access remotely** — "access from my phone", "access from outside"
- **Manage tunnels** — "show tunnels", "list tunnels", "stop tunnel", "close tunnel", "kill tunnel"

## How to respond

1. Run the CLI command
2. Share the public URL with the user
3. Mention the URL works on any device (phone, tablet, other computer)
4. If the user hasn't started a dev server yet, remind them to start one first

## Example flow

User: "I want to see this React app on my phone"
→ Check if dev server is running (e.g. port 5173 for Vite)
→ Run: \`viben tunnel add 5173 --label react-app\`
→ Share the public URL
`;
}

function generateHandoffCommand(_agentKey: string, spec: AgentHooksIntegrationSpec): string {
  const sidVar = spec.sessionIdVar ?? "SESSION_ID";
  const cwdVar = spec.workingDirVar ?? "WORKING_DIR";
  const hooksDir = expandPath(spec.hooksDirPath);

  return `---
description: Transfer current session to Viben (Telegram/Discord)
---

Look at the context injected at the start of this message to find
${sidVar} and ${cwdVar}, then run:

bash ${hooksDir}viben-handoff.sh <${sidVar}> <${cwdVar}> <args if any>

Usage: /viben:handoff [channel]
  channel: name of a registered adapter (e.g. telegram), or omit for default

Examples:
  /viben:handoff
  /viben:handoff telegram
`;
}

function generateOpencodeHandoffCommand(spec: AgentPluginIntegrationSpec): string {
  return `---
name: ${spec.handoffCommandName}
description: Transfer current OpenCode session to Viben (Telegram/Discord)
---

Use OPENCODE_SESSION_ID from injected context, then run:

viben adopt opencode <OPENCODE_SESSION_ID>

If a channel argument is provided, append:

--channel <channel_name>

Usage:
  /${spec.handoffCommandName}
  /${spec.handoffCommandName} telegram
`;
}

function generateOpencodePlugin(spec: AgentPluginIntegrationSpec): string {
  return `export const VibenHandoffPlugin = async () => {
  return {
    "command.execute.before": async (input, output) => {
      if (input.command !== ${JSON.stringify(spec.handoffCommandName)}) return
      output.parts.unshift({
        id: "viben-session-inject",
        sessionID: input.sessionID,
        messageID: "viben-inject",
        type: "text",
        text: \`OPENCODE_SESSION_ID: \${input.sessionID}\\n\`,
      })
    },
  }
}
`;
}

// --- Settings mergers ---
// These functions add the inject hook to an agent's settings file without clobbering
// existing hooks. A backup (.bak) is written before any modification.

/**
 * Add the inject hook to a Claude-style settings.json (hooks nested under groups).
 * Skips if the hook is already present (idempotent).
 */
function mergeSettingsJson(settingsPath: string, hookEvent: string, hookScriptPath: string): void {
  const fullPath = expandPath(settingsPath);
  let settings: Record<string, unknown> = {};

  if (existsSync(fullPath)) {
    const raw = readFileSync(fullPath, "utf-8");
    writeFileSync(`${fullPath}.bak`, raw);
    settings = JSON.parse(raw);
  }

  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;
  settings.hooks = hooks;

  const eventHooks = (hooks[hookEvent] ?? []) as Array<{ hooks?: Array<{ type?: string; command?: string }> }>;
  hooks[hookEvent] = eventHooks;

  const alreadyInstalled = eventHooks.some((group) =>
    group.hooks?.some((h) => h.command?.includes(HOOK_MARKER)),
  );

  if (!alreadyInstalled) {
    eventHooks.push({
      hooks: [{ type: "command", command: hookScriptPath }],
    });
  }

  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, JSON.stringify(settings, null, 2) + "\n");
}

/**
 * Add the inject hook to a flat hooks.json (hooks as direct array entries).
 * Used for agents that follow the hooks.json format (e.g. Cursor, Cline).
 * Skips if the hook is already present (idempotent).
 */
function mergeHooksJson(settingsPath: string, hookEvent: string, hookScriptPath: string): void {
  const fullPath = expandPath(settingsPath);
  let config: Record<string, unknown> = { version: 1 };

  if (existsSync(fullPath)) {
    const raw = readFileSync(fullPath, "utf-8");
    writeFileSync(`${fullPath}.bak`, raw);
    config = JSON.parse(raw);
  }

  const hooks = (config.hooks ?? {}) as Record<string, unknown[]>;
  config.hooks = hooks;

  const eventHooks = (hooks[hookEvent] ?? []) as Array<{ command?: string }>;
  hooks[hookEvent] = eventHooks;

  const alreadyInstalled = eventHooks.some((h) => h.command?.includes(HOOK_MARKER));

  if (!alreadyInstalled) {
    eventHooks.push({ command: hookScriptPath });
  }

  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, JSON.stringify(config, null, 2) + "\n");
}

function removeFromSettingsJson(settingsPath: string, hookEvent: string): void {
  const fullPath = expandPath(settingsPath);
  if (!existsSync(fullPath)) return;

  const raw = readFileSync(fullPath, "utf-8");
  const settings = JSON.parse(raw);
  const hooks = settings.hooks as Record<string, unknown[]> | undefined;
  if (!hooks?.[hookEvent]) return;

  hooks[hookEvent] = (hooks[hookEvent] as Array<{ hooks?: Array<{ command?: string }> }>).filter(
    (group) => !group.hooks?.some((h) => h.command?.includes("viben-")),
  );

  if ((hooks[hookEvent] as unknown[]).length === 0) {
    delete hooks[hookEvent];
  }

  writeFileSync(fullPath, JSON.stringify(settings, null, 2) + "\n");
}

function removeFromHooksJson(settingsPath: string, hookEvent: string): void {
  const fullPath = expandPath(settingsPath);
  if (!existsSync(fullPath)) return;

  const raw = readFileSync(fullPath, "utf-8");
  const config = JSON.parse(raw);
  const hooks = config.hooks as Record<string, unknown[]> | undefined;
  if (!hooks?.[hookEvent]) return;

  hooks[hookEvent] = (hooks[hookEvent] as Array<{ command?: string }>).filter(
    (h) => !h.command?.includes("viben-"),
  );

  if ((hooks[hookEvent] as unknown[]).length === 0) {
    delete hooks[hookEvent];
  }

  writeFileSync(fullPath, JSON.stringify(config, null, 2) + "\n");
}

// --- Core install/uninstall ---

async function installHooksIntegration(agentKey: string, spec: AgentHooksIntegrationSpec): Promise<IntegrationResult> {
  const logs: string[] = [];
  try {
    // Check jq
    if (!commandExists("jq")) {
      return {
        success: false,
        logs: ["jq is required for handoff hooks. Install: brew install jq (macOS) or apt install jq (Linux)"],
      };
    }

    const hooksDir = expandPath(spec.hooksDirPath);
    mkdirSync(hooksDir, { recursive: true });

    // Inject script
    const injectPath = join(hooksDir, "viben-inject-session.sh");
    writeFileSync(injectPath, generateInjectScript(agentKey, spec));
    chmodSync(injectPath, 0o755);
    logs.push(`Created ${injectPath}`);

    // Handoff script
    const handoffPath = join(hooksDir, "viben-handoff.sh");
    writeFileSync(handoffPath, generateHandoffScript(agentKey));
    chmodSync(handoffPath, 0o755);
    logs.push(`Created ${handoffPath}`);

    // Slash command / skill
    if (spec.commandsPath && spec.handoffCommandName) {
      if (spec.commandFormat === "skill") {
        const skillDir = expandPath(join(spec.commandsPath, spec.handoffCommandName));
        mkdirSync(skillDir, { recursive: true });
        const skillPath = join(skillDir, "SKILL.md");
        writeFileSync(skillPath, generateHandoffCommand(agentKey, spec));
        logs.push(`Created ${skillPath}`);
      } else {
        const cmdsDir = expandPath(spec.commandsPath);
        mkdirSync(cmdsDir, { recursive: true });
        const cmdPath = join(cmdsDir, `${spec.handoffCommandName}.md`);
        writeFileSync(cmdPath, generateHandoffCommand(agentKey, spec));
        logs.push(`Created ${cmdPath}`);
      }
    }

    // Merge settings
    const injectFullPath = join(hooksDir, "viben-inject-session.sh");
    if (spec.settingsFormat === "hooks_json") {
      mergeHooksJson(spec.settingsPath, spec.hookEvent, injectFullPath);
    } else {
      mergeSettingsJson(spec.settingsPath, spec.hookEvent, injectFullPath);
    }
    logs.push(`Updated ${expandPath(spec.settingsPath)}`);

    return { success: true, logs };
  } catch (err) {
    logs.push(`Error: ${err instanceof Error ? err.message : String(err)}`);
    return { success: false, logs };
  }
}

async function uninstallHooksIntegration(agentKey: string, spec: AgentHooksIntegrationSpec): Promise<IntegrationResult> {
  const logs: string[] = [];
  try {
    const hooksDir = expandPath(spec.hooksDirPath);

    // Remove hook scripts
    for (const filename of ["viben-inject-session.sh", "viben-handoff.sh"]) {
      const filePath = join(hooksDir, filename);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        logs.push(`Removed ${filePath}`);
      }
    }

    // Remove slash command / skill
    if (spec.commandsPath && spec.handoffCommandName) {
      if (spec.commandFormat === "skill") {
        const skillDir = expandPath(join(spec.commandsPath, spec.handoffCommandName));
        const skillPath = join(skillDir, "SKILL.md");
        if (existsSync(skillPath)) {
          unlinkSync(skillPath);
          try { rmdirSync(skillDir); } catch { /* not empty */ }
          logs.push(`Removed ${skillPath}`);
        }
      } else {
        const cmdPath = expandPath(join(spec.commandsPath, `${spec.handoffCommandName}.md`));
        if (existsSync(cmdPath)) {
          unlinkSync(cmdPath);
          logs.push(`Removed ${cmdPath}`);
        }
      }
    }

    // Clean settings
    if (spec.settingsFormat === "hooks_json") {
      removeFromHooksJson(spec.settingsPath, spec.hookEvent);
    } else {
      removeFromSettingsJson(spec.settingsPath, spec.hookEvent);
    }
    logs.push(`Updated ${expandPath(spec.settingsPath)}`);

    return { success: true, logs };
  } catch (err) {
    logs.push(`Error: ${err instanceof Error ? err.message : String(err)}`);
    return { success: false, logs };
  }
}

async function installPluginIntegration(_agentKey: string, spec: AgentPluginIntegrationSpec): Promise<IntegrationResult> {
  const logs: string[] = [];
  try {
    const commandsDir = expandPath(spec.commandsPath);
    mkdirSync(commandsDir, { recursive: true });
    const commandPath = join(commandsDir, spec.handoffCommandFile);

    const pluginsDir = expandPath(spec.pluginsPath);
    mkdirSync(pluginsDir, { recursive: true });
    const pluginPath = join(pluginsDir, spec.pluginFileName);

    if (existsSync(commandPath) && existsSync(pluginPath)) {
      logs.push("Already installed, skipping.");
      return { success: true, logs };
    }

    if (existsSync(commandPath) || existsSync(pluginPath)) {
      logs.push("Overwriting existing files.");
    }

    writeFileSync(commandPath, generateOpencodeHandoffCommand(spec));
    logs.push(`Created ${commandPath}`);

    writeFileSync(pluginPath, generateOpencodePlugin(spec));
    logs.push(`Created ${pluginPath}`);

    return { success: true, logs };
  } catch (err) {
    logs.push(`Error: ${err instanceof Error ? err.message : String(err)}`);
    return { success: false, logs };
  }
}

async function uninstallPluginIntegration(_agentKey: string, spec: AgentPluginIntegrationSpec): Promise<IntegrationResult> {
  const logs: string[] = [];
  try {
    const commandPath = join(expandPath(spec.commandsPath), spec.handoffCommandFile);
    let removedCount = 0;
    if (existsSync(commandPath)) {
      unlinkSync(commandPath);
      logs.push(`Removed ${commandPath}`);
      removedCount += 1;
    }

    const pluginPath = join(expandPath(spec.pluginsPath), spec.pluginFileName);
    if (existsSync(pluginPath)) {
      unlinkSync(pluginPath);
      logs.push(`Removed ${pluginPath}`);
      removedCount += 1;
    }

    if (removedCount === 0) {
      logs.push("Nothing to remove.");
    }

    return { success: true, logs };
  } catch (err) {
    logs.push(`Error: ${err instanceof Error ? err.message : String(err)}`);
    return { success: false, logs };
  }
}

/**
 * Install the integration for an agent based on its spec strategy.
 * Routes to hooks-based or plugin-based installation depending on `spec.strategy`.
 */
export async function installIntegration(agentKey: string, spec: AgentIntegrationSpec): Promise<IntegrationResult> {
  if (isHooksIntegrationSpec(spec)) {
    return installHooksIntegration(agentKey, spec);
  }
  return installPluginIntegration(agentKey, spec);
}

/**
 * Uninstall the integration for an agent based on its spec strategy.
 * Routes to hooks-based or plugin-based removal depending on `spec.strategy`.
 */
export async function uninstallIntegration(agentKey: string, spec: AgentIntegrationSpec): Promise<IntegrationResult> {
  if (isHooksIntegrationSpec(spec)) {
    return uninstallHooksIntegration(agentKey, spec);
  }
  return uninstallPluginIntegration(agentKey, spec);
}

// --- Public API ---
// These functions build IntegrationItem objects for display and management in cmdIntegrate.

function buildHandoffItem(agentKey: string, spec: AgentIntegrationSpec): IntegrationItem {
  return {
    id: "handoff",
    name: "Handoff",
    description: "Transfer sessions between terminal and messaging platforms",
    isInstalled(): boolean {
      if (isHooksIntegrationSpec(spec)) {
        const hooksDir = expandPath(spec.hooksDirPath);
        return (
          existsSync(join(hooksDir, "viben-inject-session.sh")) &&
          existsSync(join(hooksDir, "viben-handoff.sh"))
        );
      }
      const commandPath = join(expandPath(spec.commandsPath), spec.handoffCommandFile);
      const pluginPath = join(expandPath(spec.pluginsPath), spec.pluginFileName);
      return existsSync(commandPath) && existsSync(pluginPath);
    },
    install: () => installIntegration(agentKey, spec),
    uninstall: () => uninstallIntegration(agentKey, spec),
  };
}

function getSkillBasePath(spec: AgentHooksIntegrationSpec): string {
  // Skills go into the agent's skills directory (sibling to commands/).
  // Claude: ~/.claude/skills/, Cursor: ~/.cursor/skills/
  const base = spec.commandsPath!;
  // If commandsPath ends with commands/, replace it with skills/ for skill-format agents
  const skillsBase = base.replace(/\/commands\/?$/, "/skills/");
  return expandPath(skillsBase);
}

function buildTunnelItem(spec: AgentIntegrationSpec): IntegrationItem | null {
  if (!isHooksIntegrationSpec(spec) || !spec.commandsPath) return null;
  const hooksSpec = spec;

  function getTunnelPath(): string {
    return join(getSkillBasePath(hooksSpec), "viben-tunnel", "SKILL.md");
  }

  return {
    id: "tunnel",
    name: "Tunnel",
    description: "Expose local ports to the internet via Viben tunnel",
    isInstalled(): boolean {
      return existsSync(getTunnelPath());
    },
    async install(): Promise<IntegrationResult> {
      const logs: string[] = [];
      try {
        const skillPath = getTunnelPath();
        mkdirSync(dirname(skillPath), { recursive: true });
        writeFileSync(skillPath, generateTunnelCommand());
        logs.push(`Created ${skillPath}`);
        return { success: true, logs };
      } catch (err) {
        logs.push(`Error: ${err instanceof Error ? err.message : String(err)}`);
        return { success: false, logs };
      }
    },
    async uninstall(): Promise<IntegrationResult> {
      const logs: string[] = [];
      try {
        const skillPath = getTunnelPath();
        if (existsSync(skillPath)) {
          unlinkSync(skillPath);
          try { rmdirSync(dirname(skillPath)); } catch { /* not empty */ }
          logs.push(`Removed ${skillPath}`);
        }
        return { success: true, logs };
      } catch (err) {
        logs.push(`Error: ${err instanceof Error ? err.message : String(err)}`);
        return { success: false, logs };
      }
    },
  };
}

/**
 * Return all integration items for the given agent, or undefined if the agent
 * has no integration support. Includes both handoff and tunnel items where applicable.
 */
export function getIntegration(agentName: string): AgentIntegration | undefined {
  const caps = getAgentCapabilities(agentName);
  if (!caps.integration) return undefined;
  const items: IntegrationItem[] = [buildHandoffItem(agentName, caps.integration)];
  const tunnelItem = buildTunnelItem(caps.integration);
  if (tunnelItem) items.push(tunnelItem);
  return { items };
}

/** Return the list of agent keys that have integration support defined. */
export function listIntegrations(): string[] {
  return listAgentsWithIntegration();
}

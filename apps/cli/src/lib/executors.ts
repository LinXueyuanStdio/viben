/**
 * Executor detection and management
 *
 * Discovers locally installed coding agents (executors) like Claude Code, Cursor, etc.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import type {
  ExecutorDetector,
  DetectedExecutor,
  ExecutorCapability,
} from '../types/executor';

/**
 * Registry of known executors
 */
export const EXECUTOR_REGISTRY: ExecutorDetector[] = [
  {
    id: 'CLAUDE_CODE',
    name: 'Claude Code',
    description: "Anthropic's official CLI for Claude",
    detectCommand: 'claude --version',
    executableNames: ['claude'],
    configPaths: ['.claude', '.config/claude'],
    mcpConfigPath: '.claude/mcp_servers.json',
    settingsPath: '.claude/settings.json',
    capabilities: ['tool_use', 'mcp_support', 'multi_turn', 'extended_thinking', 'vision', 'file_editing'],
  },
  {
    id: 'CURSOR',
    name: 'Cursor',
    description: 'AI-first code editor',
    detectCommand: 'cursor --version',
    executableNames: ['cursor'],
    configPaths: ['.cursor'],
    mcpConfigPath: '.cursor/mcp.json',
    settingsPath: '.cursor/settings.json',
    capabilities: ['tool_use', 'mcp_support', 'multi_turn', 'vision', 'file_editing'],
  },
  {
    id: 'GEMINI_CLI',
    name: 'Gemini CLI',
    description: 'Google Gemini CLI',
    detectCommand: 'gemini --version',
    executableNames: ['gemini'],
    configPaths: ['.gemini', '.config/gemini'],
    settingsPath: '.gemini/settings.json',
    capabilities: ['tool_use', 'multi_turn', 'vision'],
  },
  {
    id: 'CODEX',
    name: 'OpenAI Codex',
    description: 'OpenAI Codex CLI',
    detectCommand: 'codex --version',
    executableNames: ['codex'],
    configPaths: ['.codex', '.config/codex'],
    settingsPath: '.codex/config.json',
    capabilities: ['tool_use', 'multi_turn', 'code_execution'],
  },
  {
    id: 'WINDSURF',
    name: 'Windsurf',
    description: 'Codeium IDE',
    detectCommand: 'windsurf --version',
    executableNames: ['windsurf'],
    configPaths: ['.windsurf'],
    settingsPath: '.windsurf/settings.json',
    capabilities: ['tool_use', 'multi_turn', 'file_editing'],
  },
  {
    id: 'AMP',
    name: 'Amp',
    description: 'Sourcegraph Amp',
    detectCommand: 'amp --version',
    executableNames: ['amp'],
    configPaths: ['.amp', '.config/amp'],
    settingsPath: '.amp/config.yaml',
    capabilities: ['tool_use', 'multi_turn', 'code_execution'],
  },
  {
    id: 'OPENCODE',
    name: 'OpenCode',
    description: 'Open source coding agent',
    detectCommand: 'opencode --version',
    executableNames: ['opencode'],
    configPaths: ['.opencode', '.config/opencode'],
    settingsPath: '.opencode/config.json',
    capabilities: ['tool_use', 'multi_turn', 'file_editing'],
  },
  {
    id: 'QWEN_CODE',
    name: 'Qwen Code',
    description: 'Alibaba Qwen coding agent',
    detectCommand: 'qwen-code --version',
    executableNames: ['qwen-code', 'qwen_code'],
    configPaths: ['.qwen-code', '.config/qwen-code'],
    settingsPath: '.qwen-code/config.json',
    capabilities: ['tool_use', 'multi_turn', 'vision'],
  },
  {
    id: 'AIDER',
    name: 'Aider',
    description: 'AI pair programming in your terminal',
    detectCommand: 'aider --version',
    executableNames: ['aider'],
    configPaths: ['.aider', '.config/aider'],
    settingsPath: '.aider.conf.yml',
    capabilities: ['tool_use', 'multi_turn', 'file_editing'],
  },
  {
    id: 'CONTINUE',
    name: 'Continue',
    description: 'Open-source AI code assistant',
    detectCommand: 'continue --version',
    executableNames: ['continue'],
    configPaths: ['.continue'],
    mcpConfigPath: '.continue/config.json',
    settingsPath: '.continue/config.json',
    capabilities: ['tool_use', 'mcp_support', 'multi_turn'],
  },
];

/**
 * Find executable in PATH
 */
function findExecutable(names: string[]): string | undefined {
  const pathEnv = process.env.PATH || '';
  const pathDirs = pathEnv.split(path.delimiter);

  // Also check common installation locations
  const extraDirs = [
    '/usr/local/bin',
    '/usr/bin',
    '/opt/homebrew/bin',
    path.join(os.homedir(), '.local/bin'),
    path.join(os.homedir(), 'bin'),
  ];

  // On macOS, check Applications folder
  if (process.platform === 'darwin') {
    extraDirs.push('/Applications');
  }

  const allDirs = [...new Set([...pathDirs, ...extraDirs])];

  for (const name of names) {
    for (const dir of allDirs) {
      const fullPath = path.join(dir, name);
      try {
        if (fs.existsSync(fullPath)) {
          const stat = fs.statSync(fullPath);
          if (stat.isFile() && (stat.mode & fs.constants.X_OK)) {
            return fullPath;
          }
        }
        // Check for .exe on Windows
        if (process.platform === 'win32') {
          const exePath = fullPath + '.exe';
          if (fs.existsSync(exePath)) {
            return exePath;
          }
        }
        // Check for .app on macOS
        if (process.platform === 'darwin') {
          const appPath = path.join(dir, `${name}.app`, 'Contents', 'MacOS', name);
          if (fs.existsSync(appPath)) {
            return appPath;
          }
        }
      } catch {
        // Ignore errors
      }
    }
  }

  return undefined;
}

/**
 * Get version by running detect command
 */
function getVersion(command: string): string | undefined {
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Extract version number from output
    // Common patterns: "v1.0.0", "1.0.0", "version 1.0.0", etc.
    const versionMatch = output.match(/v?(\d+\.\d+\.\d+(?:-[\w.]+)?)/i);
    if (versionMatch) {
      return versionMatch[1];
    }

    // Return first line if no version pattern found
    const firstLine = output.trim().split('\n')[0];
    return firstLine || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Find config directory
 */
function findConfigDir(configPaths: string[]): string | undefined {
  const homeDir = os.homedir();

  for (const configPath of configPaths) {
    const fullPath = path.join(homeDir, configPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      return fullPath;
    }
  }

  return undefined;
}

/**
 * Check if file exists and return full path
 */
function findConfigFile(relativePath: string | undefined): string | undefined {
  if (!relativePath) {
    return undefined;
  }

  const homeDir = os.homedir();
  const fullPath = path.join(homeDir, relativePath);

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    return fullPath;
  }

  return undefined;
}

/**
 * Detect a single executor
 */
export function detectExecutor(detector: ExecutorDetector): DetectedExecutor {
  const executablePath = findExecutable(detector.executableNames);
  const installed = !!executablePath;

  let version: string | undefined;
  if (installed) {
    version = getVersion(detector.detectCommand);
  }

  const configDir = findConfigDir(detector.configPaths);
  const mcpConfigPath = findConfigFile(detector.mcpConfigPath);
  const settingsPath = findConfigFile(detector.settingsPath);

  return {
    id: detector.id,
    name: detector.name,
    description: detector.description,
    installed,
    version,
    path: executablePath,
    configDir,
    mcpConfigPath,
    settingsPath,
    capabilities: detector.capabilities,
  };
}

/**
 * Detect all known executors
 */
export function detectAllExecutors(): DetectedExecutor[] {
  return EXECUTOR_REGISTRY.map(detectExecutor);
}

/**
 * Get executor by ID
 */
export function getExecutorById(id: string): DetectedExecutor | undefined {
  const detector = EXECUTOR_REGISTRY.find(
    (d) => d.id.toUpperCase() === id.toUpperCase()
  );

  if (!detector) {
    return undefined;
  }

  return detectExecutor(detector);
}

/**
 * Get all executor IDs
 */
export function getAllExecutorIds(): string[] {
  return EXECUTOR_REGISTRY.map((d) => d.id);
}

/**
 * Format capability for display
 */
export function formatCapability(capability: ExecutorCapability): string {
  const labels: Record<ExecutorCapability, string> = {
    tool_use: 'Tool use',
    mcp_support: 'MCP server support',
    multi_turn: 'Multi-turn conversations',
    extended_thinking: 'Extended thinking',
    vision: 'Image understanding',
    code_execution: 'Code execution',
    web_browsing: 'Web browsing',
    file_editing: 'File editing',
  };

  return labels[capability] || capability;
}

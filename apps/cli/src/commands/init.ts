/**
 * viben init - Initialize workspace
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { outputResult } from "../lib/output.js";

interface InitOptions {
  from?: string;
}

interface GlobalOptions {
  json?: boolean;
  verbose?: boolean;
  quiet?: boolean;
}

const DEFAULT_CONFIG = `# Viben Workspace Configuration
version: 1

# Agent configuration
agent: main

# MCP servers enabled in this workspace
mcp:
  enabled:
    - filesystem
    - git

# Skills enabled in this workspace
skills:
  enabled: []
`;

export async function init(
  options: InitOptions,
  globalOptions: GlobalOptions
): Promise<void> {
  const cwd = process.cwd();
  const vibenDir = join(cwd, ".viben");
  const configPath = join(vibenDir, "config.yaml");

  // Check if already initialized
  if (existsSync(vibenDir)) {
    outputResult(
      {
        success: false,
        error: {
          code: "ALREADY_INITIALIZED",
          message: `Workspace already initialized at ${vibenDir}`,
        },
      },
      globalOptions
    );
    return;
  }

  try {
    // Create .viben directory
    mkdirSync(vibenDir, { recursive: true });

    // Create config.yaml
    writeFileSync(configPath, DEFAULT_CONFIG, "utf-8");

    outputResult(
      {
        success: true,
        data: {
          path: vibenDir,
          files: ["config.yaml"],
        },
        message: `✓ Initialized Viben workspace in ${cwd}
  Created .viben/config.yaml

Next steps:
  viben mcp install <name>    # Install MCP servers
  viben skill install <name>  # Install skills`,
      },
      globalOptions
    );
  } catch (error) {
    outputResult(
      {
        success: false,
        error: {
          code: "INIT_FAILED",
          message: error instanceof Error ? error.message : String(error),
        },
      },
      globalOptions
    );
  }
}

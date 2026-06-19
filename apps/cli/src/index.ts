#!/usr/bin/env node

/**
 * Viben CLI
 *
 * This is a thin wrapper around @viben/core CLI.
 * All actual CLI logic is implemented in @viben/core.
 */

import { createProgram, run } from "@viben/core";

// Re-export CLI from @viben/core
export { createProgram, run };

run(process.argv).catch((error) => {
  const message = error instanceof Error ? error.message : "Failed to run Viben CLI";
  console.error(`\x1b[31m[ERROR]\x1b[0m ${message}`);
  process.exit(1);
});

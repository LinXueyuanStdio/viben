#!/usr/bin/env bun
/**
 * Viben CLI Entry Point (Bun binary)
 */
import { run } from "@viben/core/cli";

run().catch((err) => {
  console.error(`\x1b[31m[ERROR]\x1b[0m ${err.message || "Unknown error"}`);
  process.exit(1);
});

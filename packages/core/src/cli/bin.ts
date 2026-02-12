#!/usr/bin/env node
/**
 * Viben CLI executable entry point
 */
import { run } from "./cli";

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

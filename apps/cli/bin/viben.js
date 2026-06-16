#!/usr/bin/env node

/**
 * Viben CLI Entry Point (npm distribution)
 *
 * Thin wrapper that loads the bundled @viben/core CLI.
 */

async function main() {
  try {
    const { run } = await import('../dist/index.js');
    await run(process.argv);
  } catch (err) {
    console.error(`\x1b[31m[ERROR]\x1b[0m ${err.message || 'Failed to load Viben CLI'}`);
    process.exit(1);
  }
}

main();

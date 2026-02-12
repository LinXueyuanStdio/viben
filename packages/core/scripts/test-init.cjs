#!/usr/bin/env node
/**
 * Test script for initTeam
 *
 * Usage: node scripts/test-init.cjs [output-dir]
 */
const path = require("path");
const fs = require("fs");

async function main() {
  const outputDir = process.argv[2] || path.join(__dirname, "..", "build", "viben-test");

  // Clean output directory
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });

  console.log("Testing initTeam...");
  console.log(`Output: ${outputDir}`);

  try {
    const { initTeam } = require("../dist/index.cjs");

    const result = await initTeam({
      targetDir: outputDir,
      developerName: "test-dev",
      projectType: "fullstack",
      force: true,
      includeCursor: true,
    });

    console.log(`\n✓ Success! Created ${result.files.length} files`);
    console.log("\nGenerated structure:");

    // List top-level files
    const entries = fs.readdirSync(outputDir);
    for (const entry of entries) {
      const stat = fs.statSync(path.join(outputDir, entry));
      if (stat.isDirectory()) {
        const subEntries = fs.readdirSync(path.join(outputDir, entry));
        console.log(`  ${entry}/ (${subEntries.length} items)`);
      } else {
        console.log(`  ${entry}`);
      }
    }

    // Verify key files exist
    const expectedFiles = [
      ".viben/workflow.md",
      ".viben/scripts/task.sh",
      ".claude/settings.json",
      ".claude/agents/check.md",
      ".claude/commands/viben/start.md",
      ".claude/hooks/session-start.py",
      ".cursor/commands/viben-start.md",
      "AGENTS.md",
    ];

    console.log("\nVerifying key files:");
    let allExist = true;
    for (const file of expectedFiles) {
      const exists = fs.existsSync(path.join(outputDir, file));
      console.log(`  ${exists ? "✓" : "✗"} ${file}`);
      if (!exists) allExist = false;
    }

    if (allExist) {
      console.log("\n✓ All key files present!");
    } else {
      console.log("\n✗ Some files missing!");
      process.exit(1);
    }

  } catch (err) {
    console.error("Error:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();

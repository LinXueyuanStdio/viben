#!/usr/bin/env node
/**
 * Minimal SDK test script
 *
 * Usage: node scripts/test-sdk.mjs
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

async function main() {
  console.log("Starting minimal SDK test...\n");

  try {
    // Query with user settings to load ~/.claude/settings.json
    const result = query({
      prompt: "Say 'Hello from SDK!' and nothing else.",
      options: {
        // Load user settings from ~/.claude/settings.json
        // This includes env vars, permissions, and other config
        settingSources: ["user"],
        // Use Claude Code's system prompt and tools
        systemPrompt: { type: "preset", preset: "claude_code" },
        tools: { type: "preset", preset: "claude_code" },
      },
    });

    console.log("Query created, iterating messages...\n");

    for await (const message of result) {
      console.log(`[${message.type}]`, JSON.stringify(message, null, 2).slice(0, 500));
    }

    console.log("\nDone!");
  } catch (error) {
    console.error("Error:", error.message);
    console.error("Stack:", error.stack);
  }
}

main();

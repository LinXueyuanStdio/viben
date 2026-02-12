/**
 * Debug script for SDK streaming issue
 * Run with: npx tsx scripts/debug-sdk.ts
 */

// Clear interfering environment variables first
const INTERFERING_ENV_VARS = [
  "CLAUDE_CODE_ENTRYPOINT",
  "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
  "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS",
  "CLAUDE_CODE_ATTRIBUTION_HEADER",
  "CLAUDECODE",
];

console.log("=== Environment Check ===");
for (const varName of INTERFERING_ENV_VARS) {
  if (process.env[varName]) {
    console.log(`Found interfering env var: ${varName}=${process.env[varName]}`);
    delete process.env[varName];
    console.log(`  -> Cleared ${varName}`);
  }
}

// Check for ANTHROPIC_API_KEY
if (process.env.ANTHROPIC_API_KEY) {
  console.log("ANTHROPIC_API_KEY is set (length:", process.env.ANTHROPIC_API_KEY.length, ")");
} else {
  console.log("WARNING: ANTHROPIC_API_KEY is not set!");
}

async function main() {
  console.log("\n=== Loading SDK ===");

  try {
    const sdk = await import("@anthropic-ai/claude-agent-sdk");
    console.log("SDK loaded successfully");
    console.log("SDK exports:", Object.keys(sdk));

    console.log("\n=== Creating Query ===");

    // Try minimal options first
    const queryResult = sdk.query({
      prompt: "Say 'hello' and nothing else.",
      options: {
        cwd: process.cwd(),
        // Use bypassPermissions to avoid permission prompts
        permissionMode: "bypassPermissions",
        // Use preset system prompt and tools
        systemPrompt: { type: "preset", preset: "claude_code" },
        tools: { type: "preset", preset: "claude_code" },
        // Load user settings (includes API key from ~/.claude/settings.json)
        settingSources: ["user"],
      },
    });

    console.log("Query created, type:", typeof queryResult);
    console.log("Is AsyncGenerator:", queryResult[Symbol.asyncIterator] !== undefined);

    console.log("\n=== Starting Iteration ===");

    let messageCount = 0;
    const startTime = Date.now();

    for await (const message of queryResult) {
      messageCount++;
      const elapsed = Date.now() - startTime;

      // Type-safe message handling
      const msg = message as Record<string, unknown>;
      console.log(`\n[${elapsed}ms] Message ${messageCount}:`);
      console.log("  Type:", msg.type);

      if (msg.type === "assistant" && msg.message) {
        const innerMsg = msg.message as Record<string, unknown>;
        if (Array.isArray(innerMsg.content)) {
          for (const block of innerMsg.content) {
            if (block && typeof block === "object" && (block as Record<string, unknown>).type === "text") {
              console.log("  Text:", (block as Record<string, unknown>).text);
            }
          }
        }
      } else if (msg.type === "result") {
        console.log("  Result:", msg.result);
        console.log("  Subtype:", msg.subtype);
      } else if (msg.type === "system") {
        console.log("  System message");
      } else {
        console.log("  Raw:", JSON.stringify(message, null, 2).slice(0, 300));
      }

      // Safety limit
      if (messageCount > 50) {
        console.log("\nReached message limit, stopping...");
        break;
      }
    }

    console.log("\n=== Done ===");
    console.log("Total messages:", messageCount);
    console.log("Total time:", Date.now() - startTime, "ms");

  } catch (error) {
    console.error("\n=== Error ===");
    console.error("Error type:", error?.constructor?.name);
    console.error("Error message:", error instanceof Error ? error.message : String(error));

    if (error instanceof Error && error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }

    // Check for cause
    const cause = (error as Error & { cause?: Error }).cause;
    if (cause) {
      console.error("\nCause:", cause.message);
      if (cause.stack) {
        console.error("Cause stack:", cause.stack);
      }
    }
  }
}

main();

/**
 * Test script for SDK streaming
 * Run with: npx tsx scripts/test-sdk-streaming.ts
 */

async function main() {
  console.log("Loading SDK...");

  try {
    const sdk = await import("@anthropic-ai/claude-agent-sdk");
    console.log("SDK loaded:", Object.keys(sdk));

    console.log("\nStarting query...");

    const queryResult = sdk.query({
      prompt: "Say hello in one word",
      options: {
        cwd: process.cwd(),
        permissionMode: "bypassPermissions",
        systemPrompt: { type: "preset", preset: "claude_code" },
        tools: { type: "preset", preset: "claude_code" },
      },
    });

    console.log("Query created, starting iteration...");

    let messageCount = 0;
    for await (const message of queryResult) {
      messageCount++;
      console.log(`\nMessage ${messageCount}:`, JSON.stringify(message, null, 2).slice(0, 500));

      // Safety limit
      if (messageCount > 20) {
        console.log("Reached message limit, stopping...");
        break;
      }
    }

    console.log("\nDone! Total messages:", messageCount);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();

import * as clack from "@clack/prompts";
import { getIntegration } from "../../cli/integrate.js";
import { guardCancel } from "./helpers.js";

/**
 * Offers to install the Claude CLI integration, which enables
 * `/viben:handoff` in the terminal for session transfer between
 * Claude Code and Viben.
 */
export async function setupIntegrations(): Promise<void> {
  const integration = getIntegration("claude");
  const isInstalled = integration?.items[0]?.isInstalled() ?? false;

  const installClaude = guardCancel(
    await clack.confirm({
      message: isInstalled
        ? "Claude CLI integration is installed. Reinstall?"
        : "Install session transfer for Claude? (enables /viben:handoff in your terminal)",
      initialValue: !isInstalled,
    }),
  );

  if (installClaude) {
    try {
      if (integration) {
        for (const item of integration.items) {
          const result = await item.install();
          for (const log of result.logs) console.log(`  ${log}`);
        }
      }
      console.log("Claude CLI integration installed.\n");
    } catch (err) {
      console.log(`Could not install Claude CLI integration: ${err instanceof Error ? err.message : err}`);
      console.log("  You can install it later with: viben integrate claude\n");
    }
  }
}

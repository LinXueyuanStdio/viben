import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentManager } from "./index";

describe("AgentManager", () => {
  let tempDir: string;
  let originalStateDir: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "viben-agent-manager-test-"));
    originalStateDir = process.env.VIBEN_STATE_DIR;
    process.env.VIBEN_STATE_DIR = tempDir;
  });

  afterEach(async () => {
    if (originalStateDir) {
      process.env.VIBEN_STATE_DIR = originalStateDir;
    } else {
      delete process.env.VIBEN_STATE_DIR;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  it("persists executor configuration with snake_case frontmatter", async () => {
    const manager = new AgentManager();

    const agent = await manager.createAgent({
      id: "codex-agent",
      name: "Codex Agent",
      executor_type: "CODEX",
      executor_config: { command: "/usr/local/bin/codex-acp" },
    });

    if (!agent.path) {
      throw new Error("Expected created agent to include a path");
    }
    const content = await readFile(join(agent.path, "AGENTS.md"), "utf-8");
    expect(content).toContain("executor_type: CODEX");
    expect(content).toContain("executor_config:");
    expect(content).not.toContain("executorType:");
    expect(content).not.toContain("executorConfig:");

    const loaded = await manager.getAgent("codex-agent");
    expect(loaded?.executorType).toBe("CODEX");
    expect(loaded?.executorConfig).toEqual({ command: "/usr/local/bin/codex-acp" });
  });
});

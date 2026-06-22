import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

  it("preserves permission_mode plan when reading and writing agent config", async () => {
    const manager = new AgentManager();
    const agentDir = join(tempDir, "agents", "plan-agent");
    await mkdir(agentDir, { recursive: true });
    await writeFile(
      join(agentDir, "AGENTS.md"),
      [
        "---",
        "name: Plan Agent",
        "permission_mode: plan",
        "created_at: '2026-06-23T00:00:00.000Z'",
        "updated_at: '2026-06-23T00:00:00.000Z'",
        "---",
        "",
        "System prompt",
        "",
      ].join("\n"),
      "utf-8"
    );

    const loaded = await manager.getAgent("plan-agent");
    expect(loaded?.permissionMode).toBe("plan");

    await manager.updateAgent("plan-agent", { description: "Updated" });

    const content = await readFile(join(agentDir, "AGENTS.md"), "utf-8");
    expect(content).toContain("permission_mode: plan");
  });

  it("writes default permission_mode for new agent configs", async () => {
    const manager = new AgentManager();

    const agent = await manager.createAgent({
      id: "default-permission-agent",
      name: "Default Permission Agent",
    });

    expect(agent.permissionMode).toBe("default");

    if (!agent.path) {
      throw new Error("Expected created agent to include a path");
    }
    const content = await readFile(join(agent.path, "AGENTS.md"), "utf-8");
    expect(content).toContain("permission_mode: default");
  });
});

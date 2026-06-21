import { describe, expect, it } from "vitest";
import { buildAcpAgentConfig, getAcpAgentProviderId } from "./acp-agent-config";

describe("buildAcpAgentConfig", () => {
  it("passes only selected provider id and model for Codex sessions", () => {
    expect(buildAcpAgentConfig({
      agent: {
        id: "codex-agent",
        name: "Codex 助手",
        executor_type: "CODEX",
        source: "workspace",
        workspace_path: "/workspace",
        mcp_server_count: 0,
        skill_count: 0,
        model: "gpt-5.5",
      },
      executorType: "CODEX",
      model: "deepseek-v4-flash",
      providerId: "hexin",
      providers: [{
        id: "hexin",
        provider_type: "openai",
        base_url: "http://localhost:8777/v1",
      }],
    })).toMatchObject({
      executor_type: "CODEX",
      provider_id: "hexin",
      model: "deepseek-v4-flash",
    });
    expect(buildAcpAgentConfig({
      agent: {
        id: "codex-agent",
        name: "Codex 助手",
        executor_type: "CODEX",
        source: "workspace",
        workspace_path: "/workspace",
        mcp_server_count: 0,
        skill_count: 0,
      },
      executorType: "CODEX",
      model: "deepseek-v4-flash",
      providerId: "hexin",
      providers: [{
        id: "hexin",
        provider_type: "openai",
        base_url: "http://localhost:8777/v1",
      }],
    }).executor_config).toBeUndefined();
  });

  it("removes stale Codex provider details when provider id is selected", () => {
    expect(buildAcpAgentConfig({
      agent: {
        id: "codex-agent",
        name: "Codex 助手",
        executor_type: "CODEX",
        source: "workspace",
        workspace_path: "/workspace",
        mcp_server_count: 0,
        skill_count: 0,
        executor_config: {
          provider_id: "hexin",
          base_url: "http://localhost:8777/v1",
        },
      },
      executorType: "CODEX",
      model: "deepseek-v4-flash",
      providerId: "openai-default",
      providers: [{
        id: "openai-default",
        provider_type: "openai",
        base_url: "https://api.openai.com/v1",
      }],
    })).toMatchObject({
      provider_id: "openai-default",
      executor_config: undefined,
    });
  });

  it("reads provider id from executor_config when top-level provider id is absent", () => {
    const agent = {
      id: "claude-agent",
      name: "DeepSeek ClaudeCode",
      executor_type: "CLAUDE_CODE",
      source: "workspace",
      workspace_path: "/workspace",
      mcp_server_count: 0,
      skill_count: 0,
      model: "deepseek-v4-pro[1m]",
      executor_config: {
        provider_id: "deepseek-anthropic",
      },
    } as const;

    expect(getAcpAgentProviderId(agent)).toBe("deepseek-anthropic");
    expect(buildAcpAgentConfig({
      agent,
      executorType: "CLAUDE_CODE",
      model: "",
      providerId: null,
    })).toMatchObject({
      provider_id: "deepseek-anthropic",
      model: "deepseek-v4-pro[1m]",
    });
  });
});

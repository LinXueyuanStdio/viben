import { describe, expect, it } from "vitest";
import { buildAcpAgentConfig } from "./acp-agent-config";

describe("buildAcpAgentConfig", () => {
  it("injects selected provider routing into Codex executor config", () => {
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
      provider: "hexin",
      model: "deepseek-v4-flash",
      executor_config: {
        model_provider: "hexin",
        base_url: "http://localhost:8777/v1",
      },
    });
  });

  it("keeps explicit Codex executor routing when it is already configured", () => {
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
          model_provider: "hexin",
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
      executor_config: {
        model_provider: "hexin",
        base_url: "http://localhost:8777/v1",
      },
    });
  });
});

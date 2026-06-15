import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { executeCodeInputSchema, loadSkillInputSchema } from "./types";
import type { ExecutionResult, OutputItem } from "./types";
import type { SessionManager } from "./session-manager";
import type { SkillRegistry } from "./skill-registry";
import type { JupyterClient } from "./jupyter-client";

export const PYTHON_MCP_SERVER_NAME = "python_mcp";
export const EXECUTE_CODE_TOOL_NAME = "execute_code";
export const LOAD_SKILL_TOOL_NAME = "load_skill";

export interface PythonMcpServerOptions {
  sessionManager: SessionManager;
  skillRegistry: SkillRegistry;
  getJupyterClient: () => JupyterClient;
  getAcpSessionId: () => string;
}

export function createPythonMcpServer(options: PythonMcpServerOptions): McpServer {
  const { sessionManager, skillRegistry, getJupyterClient, getAcpSessionId } = options;

  const server = new McpServer({
    name: PYTHON_MCP_SERVER_NAME,
    version: "1.0.0",
  });

  server.tool(
    EXECUTE_CODE_TOOL_NAME,
    "Execute Python code in a Jupyter kernel bound to the current session.",
    {
      code: executeCodeInputSchema.shape.code,
      description: executeCodeInputSchema.shape.description,
    },
    async (args): Promise<CallToolResult> => {
      const { code, description } = args as { code: string; description: string };
      const acpSessionId = getAcpSessionId();
      const client = getJupyterClient();

      const kernelId = await sessionManager.getActiveKernel(acpSessionId, client);
      const codeId = await sessionManager.recordCode(acpSessionId, kernelId, { code, description });

      let result: ExecutionResult;
      try {
        result = await client.executeCode(kernelId, code);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        result = {
          status: "error",
          outputs: [],
          error: { name: "ExecutionError", value: errorMsg, traceback: [] },
        };
      }

      await sessionManager.recordResult(acpSessionId, kernelId, codeId, result);

      return {
        content: outputsToContentBlocks(result.outputs),
        structuredContent: {
          code_id: codeId,
          kernel_id: kernelId,
          status: result.status,
          block_list: result.outputs,
        },
        isError: result.status === "error" || undefined,
      } as CallToolResult;
    },
  );

  server.tool(
    LOAD_SKILL_TOOL_NAME,
    "Load a code skill into the current session, optionally running initialization code.",
    {
      skill_name: loadSkillInputSchema.shape.skill_name,
    },
    async (args): Promise<CallToolResult> => {
      const { skill_name } = args as { skill_name: string };
      const skill = await skillRegistry.getSkill(skill_name);

      let initResult: ExecutionResult | undefined;
      if (skill.code_for_interpreter) {
        const acpSessionId = getAcpSessionId();
        const client = getJupyterClient();
        const kernelId = await sessionManager.getActiveKernel(acpSessionId, client);
        const codeId = await sessionManager.recordCode(acpSessionId, kernelId, {
          code: skill.code_for_interpreter,
          description: `[skill:${skill_name}] initialization`,
        });
        initResult = await client.executeCode(kernelId, skill.code_for_interpreter);
        await sessionManager.recordResult(acpSessionId, kernelId, codeId, initResult);
      }

      let text = `<system-reminder>Loaded skill '${skill_name}'</system-reminder>\n\n`;
      text += `**${skill.description}**\n\n`;
      if (skill.code_for_agent) {
        text += `## Code for Agent\n\`\`\`python\n${skill.code_for_agent}\n\`\`\`\n\n`;
      }
      if (initResult) {
        const initText = initResult.outputs
          .map((o) => o.text ?? (o.data?.["text/plain"] as string) ?? "")
          .filter(Boolean)
          .join("\n");
        if (initText) {
          text += `<executed-result>\n${initText}\n</executed-result>\n`;
        }
      }

      return {
        content: [{ type: "text", text }],
        structuredContent: {
          skill_name,
          status: "success",
          initialization_result: initResult ?? null,
        },
      } as CallToolResult;
    },
  );

  return server;
}

function outputsToContentBlocks(outputs: OutputItem[]): CallToolResult["content"] {
  const blocks: CallToolResult["content"] = [];

  for (const output of outputs) {
    switch (output.type) {
      case "stream":
        if (output.text) {
          blocks.push({ type: "text", text: output.text });
        }
        break;
      case "execute_result":
      case "display_data": {
        const data = output.data;
        if (!data) break;
        if (data["image/png"]) {
          blocks.push({ type: "image", mimeType: "image/png", data: data["image/png"] as string });
        } else if (data["image/jpeg"]) {
          blocks.push({ type: "image", mimeType: "image/jpeg", data: data["image/jpeg"] as string });
        } else if (data["text/plain"]) {
          blocks.push({ type: "text", text: data["text/plain"] as string });
        }
        break;
      }
      case "error":
        if (output.text) {
          blocks.push({ type: "text", text: output.text });
        }
        break;
    }
  }

  if (blocks.length === 0) {
    blocks.push({ type: "text", text: "(no output)" });
  }
  return blocks;
}

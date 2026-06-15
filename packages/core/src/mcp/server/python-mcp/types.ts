import { z } from "zod";

// --- Zod schemas for MCP tool inputs ---

export const executeCodeInputSchema = z.object({
  code: z.string().describe("要执行的 Python 代码"),
  description: z.string().describe("描述此次执行的目的"),
});

export const loadSkillInputSchema = z.object({
  skill_name: z.string().describe("Skill 名称"),
});

// --- TypeScript interfaces ---

export interface KernelInfo {
  id: string;
  name: string;
  execution_state: string;
  last_activity: string;
}

export interface OutputItem {
  type: "stream" | "execute_result" | "display_data" | "error";
  stream_name?: "stdout" | "stderr";
  text?: string;
  data?: Record<string, unknown>;
}

export interface ExecutionResult {
  status: "ok" | "error";
  outputs: OutputItem[];
  error?: { name: string; value: string; traceback: string[] };
}

export interface SkillConfig {
  name: string;
  description: string;
  code_for_interpreter?: string;
  code_for_agent?: string;
}

export interface SkillMeta {
  name: string;
  description: string;
}

export interface CodeEntry {
  type: "code";
  code_id: string;
  timestamp: number;
  code: string;
  description: string;
}

export interface ResultEntry {
  type: "result";
  code_id: string;
  timestamp: number;
  status: "ok" | "error";
  outputs?: OutputItem[];
  error?: { name: string; value: string; traceback: string[] };
}

export type LogEntry = CodeEntry | ResultEntry;

export interface KernelHistory {
  kernel_id: string;
  created_at: number;
  entries: LogEntry[];
}

export interface SessionInfo {
  acp_session_id: string;
  current_kernel_id: string;
  kernel_count: number;
  created_at: number;
  last_used_at: number;
}

export interface PythonMcpConfig {
  jupyter_url: string;
  jupyter_token: string;
}

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { parseSessionJsonl } from "./demo-data";
import type { AgentMessage, ContentBlock } from "@viben/chat";

// Primary session: has subagents + tool-results — covers all test cases
const SESSION_DIR =
  process.env.CLAUDE_SESSION_DIR ||
  path.join(
    os.homedir(),
    ".claude/projects/-Users-lxy-Documents-GitHub-LinXueyuanStdio-viben/529a2177-8618-468a-bed5-65f3ee103b90"
  );
const SESSION_JSONL = `${SESSION_DIR}.jsonl`;
const SESSION_EXISTS = fs.existsSync(SESSION_JSONL);

// Secondary session: another large session for cross-validation
const SESSION2_DIR = path.join(
  os.homedir(),
  ".claude/projects/-Users-lxy-Documents-GitHub-LinXueyuanStdio-viben/b402443a-0192-4be2-83c6-f37dbfd286af"
);
const SESSION2_JSONL = `${SESSION2_DIR}.jsonl`;
const SESSION2_EXISTS = fs.existsSync(SESSION2_JSONL);

// ============================================================================
// Helper: enhanced parser that also loads subagent messages and tool-results
// ============================================================================

interface SubagentMeta {
  agentType: string;
  description: string;
}

interface ParsedSession {
  messages: AgentMessage[];
  subagents: Map<string, { meta: SubagentMeta; messages: AgentMessage[] }>;
  toolResults: Map<string, string>; // toolUseId -> content from file
}

function parseFullSession(jsonlPath: string): ParsedSession {
  const text = fs.readFileSync(jsonlPath, "utf-8");
  const messages = parseSessionJsonl(text);

  const sessionDir = jsonlPath.replace(".jsonl", "");
  const subagents = new Map<string, { meta: SubagentMeta; messages: AgentMessage[] }>();
  const toolResults = new Map<string, string>();

  // Parse subagents
  const subagentsDir = path.join(sessionDir, "subagents");
  if (fs.existsSync(subagentsDir)) {
    const files = fs.readdirSync(subagentsDir);
    const metaFiles = files.filter((f) => f.endsWith(".meta.json"));

    for (const metaFile of metaFiles) {
      const agentId = metaFile.replace(".meta.json", "");
      const metaContent = fs.readFileSync(path.join(subagentsDir, metaFile), "utf-8");
      const meta: SubagentMeta = JSON.parse(metaContent);

      const agentJsonlFile = `${agentId}.jsonl`;
      const agentJsonlPath = path.join(subagentsDir, agentJsonlFile);
      let subMessages: AgentMessage[] = [];
      if (fs.existsSync(agentJsonlPath)) {
        const subText = fs.readFileSync(agentJsonlPath, "utf-8");
        subMessages = parseSessionJsonl(subText);
      }

      subagents.set(agentId, { meta, messages: subMessages });
    }
  }

  // Parse tool-results
  const toolResultsDir = path.join(sessionDir, "tool-results");
  if (fs.existsSync(toolResultsDir)) {
    const files = fs.readdirSync(toolResultsDir);
    for (const file of files) {
      const toolUseId = file.replace(".txt", "");
      const content = fs.readFileSync(path.join(toolResultsDir, file), "utf-8");
      toolResults.set(toolUseId, content);
    }
  }

  return { messages, subagents, toolResults };
}

// ============================================================================
// Tests
// ============================================================================

describe.skipIf(!SESSION_EXISTS)("parseSessionJsonl - main session", () => {
  const text = fs.readFileSync(SESSION_JSONL, "utf-8");
  const messages = parseSessionJsonl(text);

  it("should parse non-empty message list", () => {
    expect(messages.length).toBeGreaterThan(0);
  });

  it("should have valid message types", () => {
    const validTypes = new Set([
      "user",
      "text",
      "thinking",
      "tool_use",
      "tool_result",
      "plan",
      "result",
      "error",
      "ask_question",
      "plan_mode",
    ]);
    for (const msg of messages) {
      expect(validTypes.has(msg.type)).toBe(true);
    }
  });

  it("should have unique IDs", () => {
    const ids = messages.map((m) => m.id).filter(Boolean);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should contain user messages", () => {
    const userMsgs = messages.filter((m) => m.type === "user");
    expect(userMsgs.length).toBeGreaterThan(0);
    for (const msg of userMsgs) {
      expect(msg.content).toBeTruthy();
      expect(typeof msg.content).toBe("string");
    }
  });

  it("should contain thinking messages", () => {
    const thinkingMsgs = messages.filter((m) => m.type === "thinking");
    expect(thinkingMsgs.length).toBeGreaterThan(0);
    for (const msg of thinkingMsgs) {
      expect(msg.content).toBeTruthy();
    }
  });

  it("should contain text messages from assistant", () => {
    const textMsgs = messages.filter((m) => m.type === "text");
    expect(textMsgs.length).toBeGreaterThan(0);
  });

  it("should contain tool_use messages with valid structure", () => {
    const toolUseMsgs = messages.filter((m) => m.type === "tool_use");
    expect(toolUseMsgs.length).toBeGreaterThan(0);

    for (const msg of toolUseMsgs) {
      expect(msg.name).toBeTruthy();
      expect(msg.toolUseId).toBeTruthy();
      // input is optional for some tools
    }
  });

  it("should contain tool_result messages with valid structure", () => {
    const toolResultMsgs = messages.filter((m) => m.type === "tool_result");
    expect(toolResultMsgs.length).toBeGreaterThan(0);

    for (const msg of toolResultMsgs) {
      expect(msg.toolUseId).toBeTruthy();
      // output can be string or ContentBlock[]
      if (msg.output !== undefined) {
        expect(
          typeof msg.output === "string" || Array.isArray(msg.output)
        ).toBe(true);
      }
    }
  });

  it("should have matching tool_use/tool_result pairs", () => {
    const toolUseIds = new Set(
      messages.filter((m) => m.type === "tool_use").map((m) => m.toolUseId)
    );
    const toolResultIds = new Set(
      messages.filter((m) => m.type === "tool_result").map((m) => m.toolUseId)
    );

    // Every tool_result should reference an existing tool_use
    for (const id of toolResultIds) {
      expect(toolUseIds.has(id)).toBe(true);
    }
  });

  it("should have Agent tool_use entries", () => {
    const agentCalls = messages.filter(
      (m) => m.type === "tool_use" && m.name === "Agent"
    );
    expect(agentCalls.length).toBeGreaterThan(0);

    for (const call of agentCalls) {
      expect(call.input).toBeTruthy();
      // Agent calls should have a description
      expect((call.input as Record<string, unknown>).description).toBeTruthy();
    }
  });

  it("should not have system-reminder artifacts in user messages", () => {
    const userMsgs = messages.filter((m) => m.type === "user");
    for (const msg of userMsgs) {
      if (msg.content) {
        expect(msg.content).not.toContain("<system-reminder>");
      }
    }
  });

  it("should handle content blocks as ContentBlock[] (not JSON strings)", () => {
    const toolResults = messages.filter((m) => m.type === "tool_result");
    for (const msg of toolResults) {
      if (Array.isArray(msg.output)) {
        // Verify ContentBlock[] structure
        for (const block of msg.output as ContentBlock[]) {
          expect(["text", "image"]).toContain(block.type);
          if (block.type === "text") {
            expect(typeof block.text).toBe("string");
          }
          if (block.type === "image") {
            expect(block.source).toBeTruthy();
            expect(block.source.type).toBe("base64");
            expect(typeof block.source.media_type).toBe("string");
            expect(typeof block.source.data).toBe("string");
          }
        }
      }
    }
  });

  it("should not have parser-truncated output (old 500-char bug)", () => {
    const toolResults = messages.filter((m) => m.type === "tool_result");
    for (const msg of toolResults) {
      if (typeof msg.output === "string") {
        // The old parser bug truncated output to exactly 500 chars with "..."
        if (msg.output.length === 500 && msg.output.endsWith("...")) {
          throw new Error(
            `Found output truncated to exactly 500 chars (tool ${msg.toolUseId})`
          );
        }
      }
    }
  });
});

describe.skipIf(!SESSION_EXISTS)("parseSessionJsonl - subagents", () => {
  const subagentsDir = path.join(SESSION_DIR, "subagents");
  const files = fs.readdirSync(subagentsDir);
  const metaFiles = files.filter((f) => f.endsWith(".meta.json"));

  it("should have subagent files", () => {
    expect(metaFiles.length).toBeGreaterThan(0);
  });

  it("should have valid meta.json structure", () => {
    for (const metaFile of metaFiles) {
      const content = fs.readFileSync(path.join(subagentsDir, metaFile), "utf-8");
      const meta = JSON.parse(content);
      // meta should have description at minimum
      expect(typeof meta.description).toBe("string");
      expect(meta.description.length).toBeGreaterThan(0);
    }
  });

  it("should have corresponding .jsonl for each meta file", () => {
    for (const metaFile of metaFiles) {
      const jsonlFile = metaFile.replace(".meta.json", ".jsonl");
      const jsonlPath = path.join(subagentsDir, jsonlFile);
      expect(fs.existsSync(jsonlPath)).toBe(true);
    }
  });

  it("should parse subagent JSONL files into valid messages", () => {
    for (const metaFile of metaFiles.slice(0, 5)) {
      const jsonlFile = metaFile.replace(".meta.json", ".jsonl");
      const jsonlPath = path.join(subagentsDir, jsonlFile);
      const text = fs.readFileSync(jsonlPath, "utf-8");
      const messages = parseSessionJsonl(text);

      expect(messages.length).toBeGreaterThan(0);

      // Should have at least a user message (the prompt)
      const userMsgs = messages.filter((m) => m.type === "user");
      expect(userMsgs.length).toBeGreaterThan(0);

      // Should have tool_use messages (subagents do work)
      const toolUseMsgs = messages.filter((m) => m.type === "tool_use");
      expect(toolUseMsgs.length).toBeGreaterThan(0);
    }
  });

  it("subagent messages should have no truncated output", () => {
    // Check a few subagents for reasonable output lengths
    for (const metaFile of metaFiles.slice(0, 3)) {
      const jsonlFile = metaFile.replace(".meta.json", ".jsonl");
      const jsonlPath = path.join(subagentsDir, jsonlFile);
      const text = fs.readFileSync(jsonlPath, "utf-8");
      const messages = parseSessionJsonl(text);

      const toolResults = messages.filter((m) => m.type === "tool_result");
      for (const msg of toolResults) {
        if (typeof msg.output === "string") {
          // Output should not end with "..." indicating arbitrary truncation
          // (500-char truncation was the bug we fixed)
          const last3 = msg.output.slice(-3);
          if (last3 === "...") {
            // If it ends with ..., it should be from natural content not parser truncation
            // The output should be longer than 500 chars if content is naturally longer
            // This is a heuristic check - the parser shouldn't truncate to exactly 500
            expect(msg.output.length).not.toBe(500);
          }
        }
      }
    }
  });
});

const TOOL_RESULTS_DIR = path.join(SESSION_DIR, "tool-results");
const TOOL_RESULTS_EXISTS = SESSION_EXISTS && fs.existsSync(TOOL_RESULTS_DIR);

describe.skipIf(!TOOL_RESULTS_EXISTS)("parseSessionJsonl - tool-results directory", () => {
  const toolResultsDir = TOOL_RESULTS_DIR;

  it("should have tool-result files", () => {
    const files = fs.readdirSync(toolResultsDir);
    expect(files.length).toBeGreaterThan(0);
  });

  it("tool-result files should be named with tool_use IDs", () => {
    const files = fs.readdirSync(toolResultsDir);
    for (const file of files) {
      // Format: toolu_bdrk_XXXX.txt or short-id.txt (e.g. b6x1xk0zx.txt)
      expect(file).toMatch(/^(toolu_bdrk_)?[a-zA-Z0-9]+\.txt$/);
    }
  });

  it("tool-result file IDs should correspond to tool_use messages in session or subagents", () => {
    // Collect all tool_use IDs from main session AND subagents
    const allToolUseIds = new Set<string>();

    const mainText = fs.readFileSync(SESSION_JSONL, "utf-8");
    const messages = parseSessionJsonl(mainText);
    for (const m of messages) {
      if (m.type === "tool_use" && m.toolUseId) allToolUseIds.add(m.toolUseId);
    }

    // Also check subagent sessions
    const subagentsDir = path.join(SESSION_DIR, "subagents");
    if (fs.existsSync(subagentsDir)) {
      const subFiles = fs.readdirSync(subagentsDir).filter((f) => f.endsWith(".jsonl"));
      for (const subFile of subFiles) {
        const subText = fs.readFileSync(path.join(subagentsDir, subFile), "utf-8");
        const subMessages = parseSessionJsonl(subText);
        for (const m of subMessages) {
          if (m.type === "tool_use" && m.toolUseId) allToolUseIds.add(m.toolUseId);
        }
      }
    }

    const files = fs.readdirSync(toolResultsDir);
    for (const file of files) {
      const toolUseId = file.replace(".txt", "");
      expect(allToolUseIds.has(toolUseId)).toBe(true);
    }
  });
});

describe.skipIf(!SESSION_EXISTS)("parseFullSession - integration", () => {
  const session = parseFullSession(SESSION_JSONL);

  it("should load main messages", () => {
    expect(session.messages.length).toBeGreaterThan(100);
  });

  it("should load subagents", () => {
    expect(session.subagents.size).toBeGreaterThan(0);
  });

  it("should load tool results (if directory exists)", () => {
    if (fs.existsSync(path.join(SESSION_DIR, "tool-results"))) {
      expect(session.toolResults.size).toBeGreaterThan(0);
    } else {
      expect(session.toolResults.size).toBe(0);
    }
  });

  it("subagent count should match Agent tool_use count", () => {
    const agentCalls = session.messages.filter(
      (m) => m.type === "tool_use" && m.name === "Agent"
    );
    // Each Agent call spawns a subagent
    expect(session.subagents.size).toBe(agentCalls.length);
  });

  it("should be able to link subagent messages back to Agent tool_use", () => {
    // subagent IDs in the directory map to agent- prefix + id
    for (const [agentFileId, subagent] of session.subagents) {
      // agentFileId is like "agent-a1990414412e02706"
      expect(agentFileId).toMatch(/^agent-[a-f0-9]+$/);
      expect(subagent.meta.description).toBeTruthy();
      expect(subagent.messages.length).toBeGreaterThan(0);
    }
  });

  it("message ordering should follow conversation flow", () => {
    // First message should be user or thinking
    const firstUserIdx = session.messages.findIndex((m) => m.type === "user");
    expect(firstUserIdx).toBeGreaterThanOrEqual(0);

    // After a tool_use there should eventually be a tool_result with same ID
    const toolUses = session.messages.filter((m) => m.type === "tool_use");
    for (const toolUse of toolUses.slice(0, 10)) {
      const resultIdx = session.messages.findIndex(
        (m) => m.type === "tool_result" && m.toolUseId === toolUse.toolUseId
      );
      const useIdx = session.messages.indexOf(toolUse);
      if (resultIdx !== -1) {
        expect(resultIdx).toBeGreaterThan(useIdx);
      }
    }
  });

  it("Read tool results should contain file content", () => {
    const readCalls = session.messages.filter(
      (m) => m.type === "tool_use" && m.name === "Read"
    );
    const readResults = readCalls.slice(0, 5).map((call) => {
      const result = session.messages.find(
        (m) => m.type === "tool_result" && m.toolUseId === call.toolUseId
      );
      return { call, result };
    });

    for (const { call, result } of readResults) {
      if (result && typeof result.output === "string") {
        // Read results should have multi-line content (file contents)
        expect(result.output.length).toBeGreaterThan(10);
        const filePath = (call.input as Record<string, unknown>)?.file_path;
        if (filePath) {
          // If it's a .ts/.tsx file, output should contain code-like content
          if (
            typeof filePath === "string" &&
            (filePath.endsWith(".ts") || filePath.endsWith(".tsx"))
          ) {
            expect(
              result.output.includes("import") ||
                result.output.includes("export") ||
                result.output.includes("function") ||
                result.output.includes("const") ||
                result.output.includes("interface")
            ).toBe(true);
          }
        }
      }
    }
  });

  it("Grep tool results should contain matched lines", () => {
    const grepCalls = session.messages.filter(
      (m) => m.type === "tool_use" && m.name === "Grep"
    );
    expect(grepCalls.length).toBeGreaterThan(0);

    const firstGrepResult = session.messages.find(
      (m) => m.type === "tool_result" && m.toolUseId === grepCalls[0].toolUseId
    );
    if (firstGrepResult && typeof firstGrepResult.output === "string") {
      // Grep output is typically file paths or matched lines
      expect(firstGrepResult.output.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Cross-validation with second session
// ============================================================================

describe.skipIf(!SESSION2_EXISTS)("parseSessionJsonl - cross-validation (session2)", () => {
  const text = fs.readFileSync(SESSION2_JSONL, "utf-8");
  const messages = parseSessionJsonl(text);

  it("should parse non-empty message list", () => {
    expect(messages.length).toBeGreaterThan(100);
  });

  it("should have Agent tool calls with subagent structure", () => {
    const agentCalls = messages.filter(
      (m) => m.type === "tool_use" && m.name === "Agent"
    );
    expect(agentCalls.length).toBeGreaterThan(0);

    // Verify subagent directory correspondence
    const subagentsDir = path.join(SESSION2_DIR, "subagents");
    if (fs.existsSync(subagentsDir)) {
      const metaFiles = fs.readdirSync(subagentsDir).filter((f) => f.endsWith(".meta.json"));
      expect(metaFiles.length).toBe(agentCalls.length);
    }
  });

  it("should parse without 500-char truncation artifacts", () => {
    const toolResults = messages.filter((m) => m.type === "tool_result");
    for (const msg of toolResults) {
      if (typeof msg.output === "string" && msg.output.length === 500 && msg.output.endsWith("...")) {
        throw new Error(`Truncated output found (tool ${msg.toolUseId})`);
      }
    }
  });
});

describe("parseSessionJsonl - multimodal content handling", () => {
  it("should pass ContentBlock[] directly when content has images", () => {
    // Simulate a JSONL line with image content blocks in tool_result
    const fakeJsonl = JSON.stringify({
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "test-tool-123",
            content: [
              { type: "text", text: "Screenshot captured" },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: "iVBORw0KGgoAAAANS...",
                },
              },
            ],
          },
        ],
      },
    });

    const messages = parseSessionJsonl(fakeJsonl);
    expect(messages.length).toBe(1);

    const msg = messages[0];
    expect(msg.type).toBe("tool_result");
    expect(msg.toolUseId).toBe("test-tool-123");

    // Output should be ContentBlock[] directly, not JSON string
    expect(Array.isArray(msg.output)).toBe(true);
    const blocks = msg.output as ContentBlock[];
    expect(blocks.length).toBe(2);
    expect(blocks[0].type).toBe("text");
    expect((blocks[0] as { type: "text"; text: string }).text).toBe("Screenshot captured");
    expect(blocks[1].type).toBe("image");
    expect((blocks[1] as { type: "image"; source: { type: string; media_type: string; data: string } }).source.media_type).toBe("image/png");
  });

  it("should join text-only content blocks into a single string", () => {
    const fakeJsonl = JSON.stringify({
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "test-tool-456",
            content: [
              { type: "text", text: "Line 1\n" },
              { type: "text", text: "Line 2\n" },
            ],
          },
        ],
      },
    });

    const messages = parseSessionJsonl(fakeJsonl);
    expect(messages.length).toBe(1);

    const msg = messages[0];
    expect(typeof msg.output).toBe("string");
    expect(msg.output).toBe("Line 1\nLine 2\n");
  });

  it("should handle string content directly", () => {
    const fakeJsonl = JSON.stringify({
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "test-tool-789",
            content: "Simple string output",
          },
        ],
      },
    });

    const messages = parseSessionJsonl(fakeJsonl);
    expect(messages.length).toBe(1);
    expect(messages[0].output).toBe("Simple string output");
  });
});

// ============================================================================
// Robustness & edge case tests
// ============================================================================

describe("parseSessionJsonl - robustness", () => {
  it("should skip malformed JSON lines without crashing", () => {
    const input = [
      '{"type":"assistant","message":{"content":[{"type":"text","text":"Hello"}]}}',
      "this is not json {{{",
      "",
      '{"type":"user","message":{"content":"World"}}',
      "null",
    ].join("\n");

    const messages = parseSessionJsonl(input);
    // Should parse the valid lines and skip invalid ones
    expect(messages.length).toBe(2);
    expect(messages[0].type).toBe("text");
    expect(messages[0].content).toBe("Hello");
    expect(messages[1].type).toBe("user");
    expect(messages[1].content).toBe("World");
  });

  it("should deduplicate tool_use entries with same ID", () => {
    // Claude Code streaming can emit the same tool_use in multiple JSONL lines
    const toolUse = {
      type: "tool_use",
      id: "toolu_duplicate_123",
      name: "Read",
      input: { file_path: "/tmp/test.ts" },
    };
    const input = [
      JSON.stringify({ type: "assistant", message: { content: [toolUse] } }),
      JSON.stringify({ type: "assistant", message: { content: [toolUse] } }),
      JSON.stringify({ type: "assistant", message: { content: [toolUse] } }),
    ].join("\n");

    const messages = parseSessionJsonl(input);
    const toolUses = messages.filter((m) => m.type === "tool_use");
    expect(toolUses.length).toBe(1);
    expect(toolUses[0].toolUseId).toBe("toolu_duplicate_123");
  });

  it("should strip <system-reminder> from user messages", () => {
    const input = JSON.stringify({
      type: "user",
      message: {
        content: "Hello <system-reminder>secret stuff</system-reminder> world",
      },
    });

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe("Hello  world");
    expect(messages[0].content).not.toContain("<system-reminder>");
  });

  it("should skip <local-command prefixed user messages", () => {
    const input = JSON.stringify({
      type: "user",
      message: {
        content: "<local-command>some internal command</local-command>",
      },
    });

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(0);
  });

  it("should handle empty JSONL input", () => {
    expect(parseSessionJsonl("")).toEqual([]);
    expect(parseSessionJsonl("\n\n\n")).toEqual([]);
  });

  it("should handle progress/system/queue-operation entries gracefully", () => {
    const input = [
      JSON.stringify({ type: "progress", data: { type: "hook_progress" } }),
      JSON.stringify({ type: "system", message: {} }),
      JSON.stringify({ type: "queue-operation", data: {} }),
      JSON.stringify({ type: "file-history-snapshot", snapshot: {} }),
      JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Result" }] } }),
    ].join("\n");

    const messages = parseSessionJsonl(input);
    // Only the assistant message should produce output
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe("Result");
  });

  it("should extract thinking content from assistant messages", () => {
    const input = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          { type: "thinking", thinking: "Let me think about this..." },
          { type: "text", text: "Here is my answer" },
        ],
      },
    });

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(2);
    expect(messages[0].type).toBe("thinking");
    expect(messages[0].content).toBe("Let me think about this...");
    expect(messages[1].type).toBe("text");
    expect(messages[1].content).toBe("Here is my answer");
  });

  it("should handle tool_result with is_error flag", () => {
    const input = JSON.stringify({
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_err_1",
            content: "Command failed with exit code 1",
            is_error: true,
          },
        ],
      },
    });

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(1);
    expect(messages[0].type).toBe("tool_result");
    expect(messages[0].isError).toBe(true);
    expect(messages[0].output).toBe("Command failed with exit code 1");
  });
});

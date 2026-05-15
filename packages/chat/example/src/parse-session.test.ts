import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { parseSessionJsonl } from "./demo-data";
import type { AgentMessage, ContentBlock } from "@viben/chat";

// ============================================================================
// Session path discovery
// ============================================================================

const TEST_PATHS_FILE = path.join(__dirname, "..", ".test_session_paths");
const SESSION_PATHS: string[] = fs.existsSync(TEST_PATHS_FILE)
  ? fs
      .readFileSync(TEST_PATHS_FILE, "utf-8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && fs.existsSync(l))
  : [];

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
  toolResults: Map<string, string>;
}

function parseFullSession(jsonlPath: string): ParsedSession {
  const text = fs.readFileSync(jsonlPath, "utf-8");
  const messages = parseSessionJsonl(text);

  const sessionDir = jsonlPath.replace(".jsonl", "");
  const subagents = new Map<
    string,
    { meta: SubagentMeta; messages: AgentMessage[] }
  >();
  const toolResults = new Map<string, string>();

  // Parse subagents
  const subagentsDir = path.join(sessionDir, "subagents");
  if (fs.existsSync(subagentsDir)) {
    const files = fs.readdirSync(subagentsDir);
    const metaFiles = files.filter((f) => f.endsWith(".meta.json"));

    for (const metaFile of metaFiles) {
      const agentId = metaFile.replace(".meta.json", "");
      const metaContent = fs.readFileSync(
        path.join(subagentsDir, metaFile),
        "utf-8"
      );
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
      const content = fs.readFileSync(
        path.join(toolResultsDir, file),
        "utf-8"
      );
      toolResults.set(toolUseId, content);
    }
  }

  return { messages, subagents, toolResults };
}

// ============================================================================
// Multi-session tests — reads from .test_session_paths
// ============================================================================

describe.skipIf(SESSION_PATHS.length === 0)(
  "parseSessionJsonl - multi-session battery",
  () => {
    // Parse all sessions upfront (shared across tests)
    const sessions = SESSION_PATHS.map((p) => ({
      path: p,
      name: path.basename(p, ".jsonl"),
      size: fs.statSync(p).size,
    }));

    it("should have loaded session paths from .test_session_paths", () => {
      expect(sessions.length).toBeGreaterThan(0);
      console.log(
        `Testing ${sessions.length} sessions (${sessions.map((s) => `${(s.size / 1048576).toFixed(1)}MB`).join(", ")})`
      );
    });

    describe.each(sessions)("session $name ($size bytes)", ({ path: p, name }) => {
      let messages: AgentMessage[];
      let parseError: Error | null = null;

      try {
        const text = fs.readFileSync(p, "utf-8");
        messages = parseSessionJsonl(text);
      } catch (e) {
        parseError = e as Error;
        messages = [];
      }

      it("should parse without throwing", () => {
        expect(parseError).toBeNull();
      });

      it("should produce non-empty message list", () => {
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
          expect(
            validTypes.has(msg.type),
            `Invalid type "${msg.type}" in ${name} (id=${msg.id})`
          ).toBe(true);
        }
      });

      it("should have unique IDs", () => {
        const ids = messages.map((m) => m.id).filter(Boolean);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
      });

      it("should have user messages with content", () => {
        const userMsgs = messages.filter((m) => m.type === "user");
        expect(userMsgs.length).toBeGreaterThan(0);
        for (const msg of userMsgs) {
          expect(msg.content).toBeTruthy();
        }
      });

      it("should have tool_use with matching tool_result", () => {
        const toolUseIds = new Set(
          messages
            .filter((m) => m.type === "tool_use")
            .map((m) => m.toolUseId)
        );
        const toolResultIds = messages
          .filter((m) => m.type === "tool_result")
          .map((m) => m.toolUseId);

        for (const id of toolResultIds) {
          expect(
            toolUseIds.has(id),
            `Orphan tool_result ${id} in ${name}`
          ).toBe(true);
        }
      });

      it("should not have 500-char truncation artifacts", () => {
        const toolResults = messages.filter((m) => m.type === "tool_result");
        for (const msg of toolResults) {
          if (typeof msg.output === "string") {
            if (msg.output.length === 500 && msg.output.endsWith("...")) {
              throw new Error(
                `Truncated output in ${name} (tool ${msg.toolUseId})`
              );
            }
          }
        }
      });

      it("should not have system-reminder in user messages", () => {
        const userMsgs = messages.filter((m) => m.type === "user");
        for (const msg of userMsgs) {
          if (msg.content) {
            expect(msg.content).not.toContain("<system-reminder>");
          }
        }
      });

      it("should handle ContentBlock[] output correctly", () => {
        const toolResults = messages.filter((m) => m.type === "tool_result");
        for (const msg of toolResults) {
          if (Array.isArray(msg.output)) {
            for (const block of msg.output as ContentBlock[]) {
              expect(["text", "image"]).toContain(block.type);
            }
          }
        }
      });

      it("tool_use → tool_result ordering should be preserved", () => {
        // Spot-check first 20 tool_use messages
        const toolUses = messages
          .filter((m) => m.type === "tool_use")
          .slice(0, 20);
        for (const toolUse of toolUses) {
          const resultIdx = messages.findIndex(
            (m) =>
              m.type === "tool_result" && m.toolUseId === toolUse.toolUseId
          );
          if (resultIdx !== -1) {
            const useIdx = messages.indexOf(toolUse);
            expect(resultIdx).toBeGreaterThan(useIdx);
          }
        }
      });
    });
  }
);

// ============================================================================
// Multi-session subagent tests
// ============================================================================

describe.skipIf(SESSION_PATHS.length === 0)(
  "parseFullSession - subagent integration",
  () => {
    // Only test sessions that have subagent directories
    const sessionsWithSubagents = SESSION_PATHS.filter((p) =>
      fs.existsSync(path.join(p.replace(".jsonl", ""), "subagents"))
    );

    it.skipIf(sessionsWithSubagents.length === 0)(
      "should find sessions with subagents",
      () => {
        expect(sessionsWithSubagents.length).toBeGreaterThan(0);
        console.log(
          `${sessionsWithSubagents.length} sessions have subagent directories`
        );
      }
    );

    describe.skipIf(sessionsWithSubagents.length === 0).each(
      sessionsWithSubagents.map((p) => ({
        path: p,
        name: path.basename(p, ".jsonl"),
      }))
    )("subagents in $name", ({ path: p }) => {
      let session: ParsedSession;
      try {
        session = parseFullSession(p);
      } catch {
        session = {
          messages: [],
          subagents: new Map(),
          toolResults: new Map(),
        };
      }

      it("should load subagents", () => {
        expect(session.subagents.size).toBeGreaterThan(0);
      });

      it("each subagent should have valid meta and messages", () => {
        for (const [agentId, sub] of session.subagents) {
          expect(
            sub.meta.description,
            `Missing description for ${agentId}`
          ).toBeTruthy();
          expect(
            sub.messages.length,
            `Empty messages for ${agentId}`
          ).toBeGreaterThan(0);
        }
      });

      it("subagent messages should parse without truncation", () => {
        for (const [, sub] of session.subagents) {
          const toolResults = sub.messages.filter(
            (m) => m.type === "tool_result"
          );
          for (const msg of toolResults) {
            if (
              typeof msg.output === "string" &&
              msg.output.length === 500 &&
              msg.output.endsWith("...")
            ) {
              throw new Error(`Truncated subagent output (${msg.toolUseId})`);
            }
          }
        }
      });

      it("agent-spawning tool_use count should match subagent count", () => {
        const agentCalls = session.messages.filter(
          (m) =>
            m.type === "tool_use" &&
            (m.name === "Agent" || m.name === "Task")
        );
        expect(session.subagents.size).toBe(agentCalls.length);
      });
    });
  }
);

// ============================================================================
// Synthetic / unit tests (no filesystem dependency)
// ============================================================================

describe("parseSessionJsonl - multimodal content handling", () => {
  it("should pass ContentBlock[] directly when content has images", () => {
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

    expect(Array.isArray(msg.output)).toBe(true);
    const blocks = msg.output as ContentBlock[];
    expect(blocks.length).toBe(2);
    expect(blocks[0].type).toBe("text");
    expect(
      (blocks[0] as { type: "text"; text: string }).text
    ).toBe("Screenshot captured");
    expect(blocks[1].type).toBe("image");
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
    expect(typeof messages[0].output).toBe("string");
    expect(messages[0].output).toBe("Line 1\nLine 2\n");
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
    expect(messages.length).toBe(2);
    expect(messages[0].type).toBe("text");
    expect(messages[1].type).toBe("user");
  });

  it("should deduplicate tool_use entries with same ID", () => {
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
        content:
          "Hello <system-reminder>secret stuff</system-reminder> world",
      },
    });

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe("Hello  world");
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
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "text", text: "Result" }] },
      }),
    ].join("\n");

    const messages = parseSessionJsonl(input);
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

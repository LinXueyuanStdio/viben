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

      it("should not have unstripped system-reminder blocks in user messages", () => {
        // Check for paired <system-reminder>...</system-reminder> (actual injected blocks).
        // Lone mentions of the tag name in user text (e.g. documentation) are fine.
        const re = /<system-reminder>[\s\S]*?<\/system-reminder>/;
        const userMsgs = messages.filter((m) => m.type === "user");
        for (const msg of userMsgs) {
          if (msg.content) {
            expect(
              re.test(msg.content),
              `Unstripped system-reminder block in ${name}`
            ).toBe(false);
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

describe("parseSessionJsonl - edge cases and untested code paths", () => {
  it("should skip tool_result with falsy content (null/undefined/empty string)", () => {
    // Parser checks `if (c.type === "tool_result" && c.content)` — falsy content is silently dropped
    const input = JSON.stringify({
      type: "user",
      message: {
        content: [
          { type: "tool_result", tool_use_id: "toolu_null", content: null },
          { type: "tool_result", tool_use_id: "toolu_undef" },
          { type: "tool_result", tool_use_id: "toolu_empty", content: "" },
          {
            type: "tool_result",
            tool_use_id: "toolu_valid",
            content: "valid output",
          },
        ],
      },
    });

    const messages = parseSessionJsonl(input);
    // Only the valid one should be emitted
    expect(messages.length).toBe(1);
    expect(messages[0].toolUseId).toBe("toolu_valid");
    expect(messages[0].output).toBe("valid output");
  });

  it("should handle tool_use without id (undefined seenTool key)", () => {
    // Parser does: `if (tid && seenTool.has(tid)) continue; seenTool.add(tid);`
    // When id is missing, tid is undefined → `if (undefined && ...)` is false → always adds
    const input = [
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", name: "Read", input: { file_path: "/a" } },
          ],
        },
      }),
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", name: "Write", input: { file_path: "/b" } },
          ],
        },
      }),
    ].join("\n");

    const messages = parseSessionJsonl(input);
    const toolUses = messages.filter((m) => m.type === "tool_use");
    // Both should be added since undefined ids bypass dedup
    expect(toolUses.length).toBe(2);
    expect(toolUses[0].toolUseId).toBeUndefined();
    expect(toolUses[1].toolUseId).toBeUndefined();
  });

  it("should handle user message with text-array content (no tool_result items)", () => {
    // When content is an array but has NO tool_result items, it falls through to text extraction
    const input = JSON.stringify({
      type: "user",
      message: {
        content: [
          { type: "text", text: "First part " },
          { type: "text", text: "second part" },
        ],
      },
    });

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(1);
    expect(messages[0].type).toBe("user");
    expect(messages[0].content).toBe("First part second part");
  });

  it("should handle mixed text + tool_result in user content array", () => {
    // If array has any tool_result, it goes into the tool_result branch and skips text items
    const input = JSON.stringify({
      type: "user",
      message: {
        content: [
          { type: "text", text: "Some context" },
          {
            type: "tool_result",
            tool_use_id: "toolu_mixed_1",
            content: "result data",
          },
        ],
      },
    });

    const messages = parseSessionJsonl(input);
    // The text block is ignored when tool_result is present in the array
    expect(messages.length).toBe(1);
    expect(messages[0].type).toBe("tool_result");
    expect(messages[0].output).toBe("result data");
  });

  it("should handle multiple tool_results in single user message", () => {
    // Parallel tool execution produces multiple results in one user line
    const input = JSON.stringify({
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_read_1",
            content: "file A content",
          },
          {
            type: "tool_result",
            tool_use_id: "toolu_read_2",
            content: "file B content",
          },
          {
            type: "tool_result",
            tool_use_id: "toolu_read_3",
            content: "file C content",
          },
        ],
      },
    });

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(3);
    expect(messages[0].toolUseId).toBe("toolu_read_1");
    expect(messages[1].toolUseId).toBe("toolu_read_2");
    expect(messages[2].toolUseId).toBe("toolu_read_3");
  });

  it("should handle tool_result with non-string non-array content (Object.toString)", () => {
    // Parser fallback: `output = String(c.content)` for unexpected types
    const input = JSON.stringify({
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_obj",
            content: { key: "value" },
          },
        ],
      },
    });

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(1);
    expect(messages[0].output).toBe("[object Object]");
  });

  it("should handle tool_result with numeric content", () => {
    const input = JSON.stringify({
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_num",
            content: 42,
          },
        ],
      },
    });

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(1);
    expect(messages[0].output).toBe("42");
  });

  it("should skip assistant message with non-array content", () => {
    // Parser checks: `if (!Array.isArray(content)) continue`
    const input = JSON.stringify({
      type: "assistant",
      message: { content: "just a string" },
    });

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(0);
  });

  it("should skip assistant message with null content", () => {
    const input = JSON.stringify({
      type: "assistant",
      message: { content: null },
    });

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(0);
  });

  it("should skip thinking block with empty/falsy thinking field", () => {
    // Parser checks: `if (c.type === "thinking" && c.thinking)`
    const input = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          { type: "thinking", thinking: "" },
          { type: "thinking", thinking: null },
          { type: "thinking" },
          { type: "text", text: "Answer" },
        ],
      },
    });

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(1);
    expect(messages[0].type).toBe("text");
    expect(messages[0].content).toBe("Answer");
  });

  it("should skip text block with empty/falsy text field", () => {
    // Parser checks: `if (c.type === "text" && c.text)`
    const input = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          { type: "text", text: "" },
          { type: "text", text: null },
          { type: "text" },
          { type: "text", text: "Valid text" },
        ],
      },
    });

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe("Valid text");
  });

  it("should ignore unrecognized content block types in assistant", () => {
    // Parser only handles "thinking", "text", "tool_use" — others are silently skipped
    const input = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          { type: "server_tool_use", id: "st_1", name: "web_search" },
          { type: "redacted_thinking", data: "..." },
          { type: "text", text: "Final answer" },
        ],
      },
    });

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(1);
    expect(messages[0].type).toBe("text");
    expect(messages[0].content).toBe("Final answer");
  });

  it("should handle user message that is entirely system-reminder", () => {
    // After stripping, txt becomes empty → no message emitted
    const input = JSON.stringify({
      type: "user",
      message: {
        content:
          "<system-reminder>internal context only</system-reminder>",
      },
    });

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(0);
  });

  it("should handle multiple system-reminder blocks in one message", () => {
    const input = JSON.stringify({
      type: "user",
      message: {
        content:
          "<system-reminder>first</system-reminder>Hello<system-reminder>second</system-reminder> world",
      },
    });

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe("Hello world");
  });

  it("should handle user message with missing message field", () => {
    const input = JSON.stringify({ type: "user" });

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(0);
  });

  it("should handle assistant message with missing message field", () => {
    const input = JSON.stringify({ type: "assistant" });

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(0);
  });

  it("should handle tool_result content array with mixed text and non-text blocks (no image)", () => {
    // When no image is present, only text blocks are joined
    const input = JSON.stringify({
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_mixed_blocks",
            content: [
              { type: "text", text: "Line 1\n" },
              { type: "unknown_block", data: "ignored" },
              { type: "text", text: "Line 2\n" },
            ],
          },
        ],
      },
    });

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(1);
    // Non-text blocks without images produce empty string via ternary
    expect(messages[0].output).toBe("Line 1\nLine 2\n");
  });

  it("should handle tool_result content array with text block missing text field", () => {
    // `block.text || ""` handles missing text
    const input = JSON.stringify({
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_no_text",
            content: [
              { type: "text" },
              { type: "text", text: "present" },
            ],
          },
        ],
      },
    });

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(1);
    expect(messages[0].output).toBe("present");
  });

  it("should handle consecutive assistant messages correctly", () => {
    // Simulates streaming continuation — each line is a separate assistant entry
    const input = [
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "thinking", thinking: "Initial thought" },
            { type: "text", text: "First response" },
          ],
        },
      }),
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "thinking", thinking: "More thinking" },
            { type: "text", text: "Continued response" },
          ],
        },
      }),
    ].join("\n");

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(4);
    expect(messages[0].type).toBe("thinking");
    expect(messages[1].type).toBe("text");
    expect(messages[2].type).toBe("thinking");
    expect(messages[3].type).toBe("text");
  });

  it("should handle last-prompt type entries gracefully", () => {
    const input = [
      JSON.stringify({
        type: "last-prompt",
        message: { content: "Last prompt content" },
      }),
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "text", text: "Real content" }] },
      }),
    ].join("\n");

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe("Real content");
  });

  it("should produce unique sequential IDs across all message types", () => {
    const input = [
      JSON.stringify({
        type: "user",
        message: { content: "Hello" },
      }),
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "thinking", thinking: "thinking..." },
            { type: "text", text: "response" },
            {
              type: "tool_use",
              id: "toolu_1",
              name: "Bash",
              input: { command: "ls" },
            },
          ],
        },
      }),
      JSON.stringify({
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_1",
              content: "file.txt",
            },
          ],
        },
      }),
    ].join("\n");

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(5);
    expect(messages.map((m) => m.id)).toEqual([
      "msg-0",
      "msg-1",
      "msg-2",
      "msg-3",
      "msg-4",
    ]);
  });

  it("should handle tool_use with all common tool names", () => {
    const tools = ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Agent", "AskUserQuestion"];
    const content = tools.map((name, i) => ({
      type: "tool_use",
      id: `toolu_${i}`,
      name,
      input: {},
    }));

    const input = JSON.stringify({
      type: "assistant",
      message: { content },
    });

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(tools.length);
    for (let i = 0; i < tools.length; i++) {
      expect(messages[i].type).toBe("tool_use");
      expect(messages[i].name).toBe(tools[i]);
      expect(messages[i].toolUseId).toBe(`toolu_${i}`);
    }
  });

  it("should handle tool_use with complex input objects", () => {
    const input = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            id: "toolu_complex",
            name: "Edit",
            input: {
              file_path: "/path/to/file.ts",
              old_string: "function foo() {\n  return 1;\n}",
              new_string: "function foo() {\n  return 2;\n}",
            },
          },
        ],
      },
    });

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(1);
    expect(messages[0].input).toEqual({
      file_path: "/path/to/file.ts",
      old_string: "function foo() {\n  return 1;\n}",
      new_string: "function foo() {\n  return 2;\n}",
    });
  });

  it("should handle very long tool_result content without truncation", () => {
    const longContent = "x".repeat(100_000);
    const input = JSON.stringify({
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_long",
            content: longContent,
          },
        ],
      },
    });

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(1);
    expect((messages[0].output as string).length).toBe(100_000);
  });

  it("should handle thinking block with signature field (ignored)", () => {
    // Real thinking blocks always have a `signature` field — parser ignores it
    const input = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          {
            type: "thinking",
            thinking: "Deep thought",
            signature: "EpUBCkYIAxgCIkD...",
          },
          { type: "text", text: "Answer" },
        ],
      },
    });

    const messages = parseSessionJsonl(input);
    expect(messages.length).toBe(2);
    expect(messages[0].type).toBe("thinking");
    expect(messages[0].content).toBe("Deep thought");
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

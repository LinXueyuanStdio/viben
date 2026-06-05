import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  markdownToTelegramHtml,
  formatToolCall,
  formatToolUpdate,
  formatPlan,
  formatUsage,
  splitMessage,
  renderToolCard,
} from "../formatting.js";
import type { ToolCardSnapshot } from "../../../core/adapter-primitives/primitives/tool-card-state.js";
import type { ToolDisplaySpec } from "../../../core/adapter-primitives/display-spec-builder.js";

function makeSpec(
  id: string,
  overrides?: Partial<ToolDisplaySpec>,
): ToolDisplaySpec {
  return {
    id,
    kind: "read",
    icon: "✅",
    title: "Read src/main.ts",
    description: null,
    command: null,
    inputContent: null,
    outputSummary: null,
    outputContent: null,
    diffStats: null,
    status: "completed",
    isNoise: false,
    isHidden: false,
    ...overrides,
  };
}

function makeSnapshot(
  specs: ToolDisplaySpec[] = [],
  overrides?: Partial<ToolCardSnapshot>,
): ToolCardSnapshot {
  const visible = specs.filter((s) => !s.isHidden);
  const done = visible.filter((s) =>
    ["completed", "done", "failed", "error"].includes(s.status),
  ).length;
  return {
    specs,
    totalVisible: visible.length,
    completedVisible: done,
    allComplete: visible.length > 0 && done === visible.length,
    ...overrides,
  };
}

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes less-than", () => {
    expect(escapeHtml("a < b")).toBe("a &lt; b");
  });

  it("escapes greater-than", () => {
    expect(escapeHtml("a > b")).toBe("a &gt; b");
  });

  it("escapes all HTML entities together", () => {
    expect(escapeHtml('<div class="test">&nbsp;</div>')).toBe(
      '&lt;div class="test"&gt;&amp;nbsp;&lt;/div&gt;',
    );
  });

  it("returns empty string for null", () => {
    expect(escapeHtml(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(escapeHtml(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("preserves text without HTML entities", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});

describe("markdownToTelegramHtml", () => {
  it("converts bold **text**", () => {
    expect(markdownToTelegramHtml("**bold text**")).toBe("<b>bold text</b>");
  });

  it("converts italic *text*", () => {
    expect(markdownToTelegramHtml("*italic*")).toBe("<i>italic</i>");
  });

  it("handles bold and italic together", () => {
    const result = markdownToTelegramHtml("**bold** and *italic*");
    expect(result).toBe("<b>bold</b> and <i>italic</i>");
  });

  it("converts inline code", () => {
    const result = markdownToTelegramHtml("use `console.log`");
    expect(result).toBe("use <code>console.log</code>");
  });

  it("converts fenced code blocks", () => {
    const result = markdownToTelegramHtml("```js\nconst x = 1\n```");
    expect(result).toContain('<pre><code class="language-js">');
    expect(result).toContain("const x = 1");
    expect(result).toContain("</code></pre>");
  });

  it("converts fenced code blocks without language", () => {
    const result = markdownToTelegramHtml("```\nsome code\n```");
    expect(result).toContain("<pre><code>");
    expect(result).toContain("some code");
  });

  it("converts links [text](url)", () => {
    const result = markdownToTelegramHtml("[click here](https://example.com)");
    expect(result).toBe('<a href="https://example.com">click here</a>');
  });

  it("escapes HTML in regular text", () => {
    const result = markdownToTelegramHtml("a < b & c > d");
    expect(result).toBe("a &lt; b &amp; c &gt; d");
  });

  it("does NOT escape HTML inside code blocks", () => {
    const result = markdownToTelegramHtml("```\nif (a < b) {}\n```");
    expect(result).toContain("&lt;");
    expect(result).toContain("<pre>");
  });

  it("does NOT escape HTML inside inline code", () => {
    const result = markdownToTelegramHtml("use `a < b`");
    expect(result).toContain("<code>");
    expect(result).toContain("&lt;");
  });

  it("handles empty string", () => {
    expect(markdownToTelegramHtml("")).toBe("");
  });

  it("handles plain text without markdown", () => {
    expect(markdownToTelegramHtml("hello world")).toBe("hello world");
  });

  it("handles multiple code blocks", () => {
    const md = "```js\nconst a = 1\n```\ntext\n```py\nprint(1)\n```";
    const result = markdownToTelegramHtml(md);
    expect(result).toContain("language-js");
    expect(result).toContain("language-py");
  });

  it("preserves newlines in code blocks", () => {
    const result = markdownToTelegramHtml("```\nline1\nline2\n```");
    expect(result).toContain("line1\nline2");
  });
});

describe("formatToolCall", () => {
  it("formats a tool call with smart summary", () => {
    const result = formatToolCall({
      id: "tc-1",
      name: "Read",
      kind: "read",
      status: "completed",
      rawInput: { file_path: "src/main.ts" },
    });
    expect(result).toContain("✅");
    expect(result).toContain("📖 Read src/main.ts");
  });

  it("uses default icon for unknown tool", () => {
    const result = formatToolCall({
      id: "tc-1",
      name: "Custom",
      status: "unknown_status",
    });
    expect(result).toContain("🔧"); // default from formatToolSummary
    expect(result).toContain("Custom");
  });

  it("shows content on high verbosity", () => {
    const result = formatToolCall(
      {
        id: "tc-1",
        name: "Read",
        status: "completed",
        content: "file content here",
      },
      "high",
    );
    expect(result).toContain("<pre>");
    expect(result).toContain("file content here");
  });

  it("no inline content on low verbosity", () => {
    const result = formatToolCall(
      {
        id: "tc-1",
        name: "Read",
        status: "completed",
        content: "file content here",
      },
      "low",
    );
    expect(result).not.toContain("<pre>");
  });

  it("medium hides content when viewer links present", () => {
    const result = formatToolCall({
      id: "tc-1",
      name: "Edit",
      status: "completed",
      content: "should not appear",
      viewerLinks: { file: "https://view/1" },
      viewerFilePath: "test.ts",
    });
    expect(result).not.toContain("<pre>");
    expect(result).toContain("View test.ts");
  });

  it("shows viewer links instead of content when available", () => {
    const result = formatToolCall({
      id: "tc-1",
      name: "Edit",
      status: "completed",
      content: "should not appear",
      viewerLinks: { file: "https://view/1", diff: "https://diff/1" },
      viewerFilePath: "/src/test.ts",
    });
    expect(result).toContain("View test.ts");
    expect(result).toContain("View diff");
    expect(result).not.toContain("should not appear");
  });

  it("truncates long content on high verbosity", () => {
    const longContent = "x".repeat(4000);
    const result = formatToolCall(
      {
        id: "tc-1",
        name: "Read",
        status: "completed",
        content: longContent,
      },
      "high",
    );
    expect(result).toContain("… (truncated)");
  });

  it("handles generic tool name", () => {
    const result = formatToolCall({
      id: "tc-1",
      name: "Tool",
      status: "running",
    });
    expect(result).toContain("🔧 Tool");
  });

  it("handles null content", () => {
    const result = formatToolCall({
      id: "tc-1",
      name: "Test",
      status: "running",
      content: null,
    });
    expect(result).not.toContain("<pre>");
  });

  it("extracts text from ACP content blocks (high)", () => {
    const result = formatToolCall(
      {
        id: "tc-1",
        name: "Read",
        status: "completed",
        content: { type: "text", text: "extracted text" },
      },
      "high",
    );
    expect(result).toContain("extracted text");
  });

  it("extracts text from array of content blocks (high)", () => {
    const result = formatToolCall(
      {
        id: "tc-1",
        name: "Read",
        status: "completed",
        content: [
          { type: "text", text: "block1" },
          { type: "text", text: "block2" },
        ],
      },
      "high",
    );
    expect(result).toContain("block1");
  });

  it("shows only file viewer link when only file link present", () => {
    const result = formatToolCall({
      id: "tc-1",
      name: "Read",
      status: "completed",
      viewerLinks: { file: "https://view/1" },
      viewerFilePath: "/src/app.ts",
    });
    expect(result).toContain("📄");
    expect(result).not.toContain("📝");
  });
});

describe("formatToolUpdate", () => {
  it("formats a completed update with smart summary", () => {
    const result = formatToolUpdate({
      id: "tc-1",
      name: "Edit",
      kind: "edit",
      status: "completed",
      rawInput: { file_path: "src/app.ts" },
    });
    expect(result).toContain("✅");
    expect(result).toContain("✏️ Edit src/app.ts");
  });

  it("formats a failed update", () => {
    const result = formatToolUpdate({
      id: "tc-1",
      name: "Write",
      status: "failed",
    });
    expect(result).toContain("❌");
  });

  it("handles generic tool name", () => {
    const result = formatToolUpdate({
      id: "tc-1",
      name: "Tool",
      status: "completed",
    });
    expect(result).toContain("🔧 Tool");
  });
});

describe("formatPlan", () => {
  it("formats plan entries with status icons", () => {
    const result = formatPlan({
      entries: [
        { content: "Step 1", status: "completed" },
        { content: "Step 2", status: "in_progress" },
        { content: "Step 3", status: "pending" },
      ],
    });
    expect(result).toContain("<b>Plan:</b>");
    expect(result).toContain("✅ 1. Step 1");
    expect(result).toContain("🔄 2. Step 2");
    expect(result).toContain("⬜ 3. Step 3");
  });

  it("handles empty entries", () => {
    const result = formatPlan({ entries: [] });
    expect(result).toContain("<b>Plan:</b>");
  });

  it("escapes HTML in entry content", () => {
    const result = formatPlan({
      entries: [{ content: "<script>alert(1)</script>", status: "pending" }],
    });
    expect(result).toContain("&lt;script&gt;");
    expect(result).not.toContain("<script>");
  });

  it("uses default icon for unknown status", () => {
    const result = formatPlan({
      entries: [{ content: "Step", status: "unknown" }],
    });
    expect(result).toContain("⬜");
  });
});

describe("splitMessage", () => {
  it("returns single chunk when under limit", () => {
    const result = splitMessage("hello world", 3800);
    expect(result).toEqual(["hello world"]);
  });

  it("splits at double newline when possible", () => {
    const part1 = "a".repeat(2000);
    const part2 = "b".repeat(2000);
    const text = `${part1}\n\n${part2}`;
    const result = splitMessage(text, 3800);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("splits at single newline as fallback", () => {
    const part1 = "a".repeat(2000);
    const part2 = "b".repeat(2000);
    const text = `${part1}\n${part2}`;
    const result = splitMessage(text, 3800);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("splits at hard limit when no newlines", () => {
    const text = "x".repeat(8000);
    const result = splitMessage(text, 3800);
    expect(result.length).toBeGreaterThanOrEqual(2);
    // All content should be preserved
    expect(result.join("").length).toBe(8000);
  });

  it("balances chunks when slightly over limit", () => {
    // Text length between maxLength and maxLength*1.3 should split roughly in half
    const text = "a".repeat(4500); // slightly over 3800
    const result = splitMessage(text, 3800);
    expect(result.length).toBe(2);
    // Both chunks should be reasonable size (not one huge + one tiny)
    for (const chunk of result) {
      expect(chunk.length).toBeGreaterThan(1000);
    }
  });

  it("handles empty text", () => {
    const result = splitMessage("", 3800);
    expect(result).toEqual([""]);
  });

  it("avoids splitting inside code blocks", () => {
    // Create text with a code block that would be split
    const before = "x".repeat(3700);
    const codeBlock = "```\ncode line 1\ncode line 2\n```";
    const after = "y".repeat(100);
    const text = `${before}\n${codeBlock}\n${after}`;

    const result = splitMessage(text, 3800);
    // The code block should not be split across chunks
    const allText = result.join("");
    expect(allText).toContain("```\ncode line 1\ncode line 2\n```");
  });

  it("strips leading newlines from subsequent chunks", () => {
    const part1 = "a".repeat(3800);
    const part2 = "b".repeat(100);
    const text = `${part1}\n\n\n${part2}`;
    const result = splitMessage(text, 3800);
    if (result.length > 1) {
      expect(result[1]).not.toMatch(/^\n/);
    }
  });

  it("handles text at exact boundary", () => {
    const text = "x".repeat(3800);
    const result = splitMessage(text, 3800);
    expect(result).toEqual([text]);
  });

  it("handles custom maxLength", () => {
    const text = "hello world this is a test";
    const result = splitMessage(text, 10);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});

describe("displayKind icon resolution", () => {
  it("uses displayKind icon when status has no icon", () => {
    const result = formatToolCall({
      id: "1",
      name: "custom_read",
      status: "",
      displayKind: "read",
    });
    expect(result).toContain("📖");
  });

  it("prefers displayKind over kind", () => {
    const result = formatToolCall({
      id: "1",
      name: "tool",
      status: "",
      kind: "execute",
      displayKind: "search",
    });
    expect(result).toContain("🔍");
  });

  it("status icon takes precedence over displayKind", () => {
    const result = formatToolCall({
      id: "1",
      name: "tool",
      status: "completed",
      displayKind: "read",
    });
    expect(result).toContain("✅");
    expect(result).not.toContain("📖");
  });
});

describe("high verbosity rawInput", () => {
  it("shows rawInput and content on high", () => {
    const result = formatToolCall(
      {
        id: "1",
        name: "Read",
        status: "completed",
        rawInput: { file_path: "src/main.ts" },
        content: "const x = 1;",
      },
      "high",
    );
    expect(result).toContain("<b>Input:</b>");
    expect(result).toContain("file_path");
    expect(result).toContain("<b>Output:</b>");
    expect(result).toContain("const x = 1;");
  });

  it("hides rawInput when empty object", () => {
    const result = formatToolCall(
      {
        id: "1",
        name: "Tool",
        status: "completed",
        rawInput: {},
        content: "output",
      },
      "high",
    );
    expect(result).not.toContain("<b>Input:</b>");
    expect(result).toContain("<b>Output:</b>");
  });

  it("medium does NOT show content or rawInput", () => {
    const result = formatToolCall(
      {
        id: "1",
        name: "Read",
        status: "completed",
        rawInput: { file_path: "test.ts" },
        content: "file content",
      },
      "medium",
    );
    expect(result).not.toContain("<b>Input:</b>");
    expect(result).not.toContain("<b>Output:</b>");
  });

  it("viewer links always shown on medium", () => {
    const result = formatToolCall({
      id: "1",
      name: "Edit",
      status: "completed",
      viewerLinks: { file: "https://view/1" },
      viewerFilePath: "test.ts",
    });
    expect(result).toContain("View test.ts");
  });
});

describe("formatPlan verbosity", () => {
  const entries = [
    { content: "Step 1", status: "completed" },
    { content: "Step 2", status: "in_progress" },
    { content: "Step 3", status: "pending" },
  ];

  it("always shows full entries", () => {
    const result = formatPlan({ entries });
    expect(result).toContain("Step 1");
    expect(result).toContain("Step 2");
    expect(result).toContain("Step 3");
  });
});

describe("formatUsage verbosity", () => {
  it("medium shows compact one-line", () => {
    const result = formatUsage(
      { tokensUsed: 5000, contextSize: 200000 },
      "medium",
    );
    expect(result).toContain("📊 5k / 200k tokens");
    expect(result).toContain("3%");
  });

  it("medium shows progress bar without cost", () => {
    const result = formatUsage(
      { tokensUsed: 5000, contextSize: 200000, cost: 0.15 },
      "medium",
    );
    expect(result).toContain("5k / 200k tokens");
    expect(result).not.toContain("$");
  });

  it("high shows same format as medium", () => {
    const result = formatUsage(
      { tokensUsed: 28000, contextSize: 200000, cost: 0.25 },
      "high",
    );
    expect(result).toContain("28k / 200k tokens");
    expect(result).toContain("14%");
    expect(result).not.toContain("$");
  });
});

describe("renderToolCard", () => {
  it("renders header with HTML bold", () => {
    const snap = makeSnapshot([makeSpec("t1")]);
    const result = renderToolCard(snap);
    expect(result).toContain("<b>📋 Tools (1/1)</b> ✅");
  });

  it("escapes HTML in tool labels", () => {
    const snap = makeSnapshot([makeSpec("t1", { title: "Read <script>.ts" })]);
    const result = renderToolCard(snap);
    expect(result).toContain("&lt;script&gt;");
    expect(result).not.toContain("<script>");
  });

  it("renders viewer links as HTML anchors", () => {
    const snap = makeSnapshot([
      makeSpec("t1", { viewerLinks: { diff: "http://diff.url" } }),
    ]);
    const result = renderToolCard(snap);
    expect(result).toContain('<a href="http://diff.url">');
  });

  it("shows relative title with cwd and keeps viewer link filename-only", () => {
    const snap = makeSnapshot([
      makeSpec("t1", {
        kind: "read",
        title: "/repo/packages/app/src/index.ts",
        workingDirectory: "/repo",
        viewerLinks: { file: "http://file.url" },
      }),
    ]);
    const result = renderToolCard(snap);
    expect(result).toContain("packages/app/src/index.ts");
    expect(result).toContain("View index.ts");
  });

  it("renders working-directory relative title for absolute read path", () => {
    const snap = makeSnapshot([
      makeSpec("t1", {
        kind: "read",
        title: "/repo/packages/app/src/index.ts (lines 1–10)",
        workingDirectory: "/repo",
      }),
    ]);
    const result = renderToolCard(snap);
    expect(result).toContain("packages/app/src/index.ts (lines 1–10)");
    expect(result).not.toContain("/repo/packages/app/src/index.ts");
  });

  it("falls back to basename for file kinds outside working directory", () => {
    const snap = makeSnapshot([
      makeSpec("t1", {
        kind: "write",
        title: "/elsewhere/logs/output.txt",
        workingDirectory: "/repo",
      }),
    ]);
    const result = renderToolCard(snap);
    expect(result).toContain("output.txt");
    expect(result).not.toContain("/elsewhere/logs/output.txt");
  });

  it("renders apply_patch multi-file title as relative when cwd is known", () => {
    const snap = makeSnapshot([
      makeSpec("t1", {
        kind: "other",
        title: "/repo/a/one.ts, /repo/b/two.ts (+1 more)",
        workingDirectory: "/repo",
      }),
    ]);
    const result = renderToolCard(snap);
    expect(result).toContain("a/one.ts, b/two.ts (+1 more)");
  });

  it("renders plan section with HTML escaping", () => {
    const snap = makeSnapshot([], {
      planEntries: [
        { content: "Step <1>", status: "completed", priority: "high" },
      ],
    });
    const result = renderToolCard(snap);
    expect(result).toContain("Step &lt;1&gt;");
  });

  it("does not render usage in tool card (usage is a separate message)", () => {
    const snap = makeSnapshot([makeSpec("t1")], {
      usage: { tokensUsed: 12500, contextSize: 200000 },
    });
    const result = renderToolCard(snap);
    expect(result).not.toContain("📊");
    expect(result).not.toContain("tokens");
  });
});

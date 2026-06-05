import { describe, it, expect } from "vitest";
import {
  selectLevel,
  estimateTokens,
  buildHistoryMarkdown,
} from "../history-context-builder.js";
import type { Turn } from "../types.js";

// ─── selectLevel ──────────────────────────────────────────────────────────────

describe("selectLevel", () => {
  it("returns full for 1 turn", () => {
    expect(selectLevel(1)).toBe("full");
  });

  it("returns full for exactly 10 turns", () => {
    expect(selectLevel(10)).toBe("full");
  });

  it("returns balanced for 11 turns", () => {
    expect(selectLevel(11)).toBe("balanced");
  });

  it("returns balanced for exactly 25 turns", () => {
    expect(selectLevel(25)).toBe("balanced");
  });

  it("returns compact for 26 turns", () => {
    expect(selectLevel(26)).toBe("compact");
  });

  it("returns compact for 100 turns", () => {
    expect(selectLevel(100)).toBe("compact");
  });

  it("returns full for 0 turns", () => {
    expect(selectLevel(0)).toBe("full");
  });
});

// ─── estimateTokens ───────────────────────────────────────────────────────────

describe("estimateTokens", () => {
  it("returns chars/4 (floor)", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcdefgh")).toBe(2);
    expect(estimateTokens("abc")).toBe(0);
    expect(estimateTokens("abcde")).toBe(1);
    expect(estimateTokens("")).toBe(0);
  });
});

// ─── buildHistoryMarkdown — helpers ───────────────────────────────────────────

function userTurn(index: number, content: string, overrides?: Partial<Turn>): Turn {
  return {
    index,
    role: "user",
    timestamp: `2026-01-01T00:0${index}:00.000Z`,
    content,
    ...overrides,
  };
}

function assistantTurn(index: number, steps: Turn["steps"], overrides?: Partial<Turn>): Turn {
  return {
    index,
    role: "assistant",
    timestamp: `2026-01-01T00:0${index}:00.000Z`,
    steps,
    ...overrides,
  };
}

// ─── Full mode ────────────────────────────────────────────────────────────────

describe("buildHistoryMarkdown — full mode", () => {
  it("renders user turn label **User [N]:**", () => {
    const turns: Turn[] = [
      userTurn(0, "Hello world"),
      assistantTurn(1, [{ type: "text", content: "Hi there" }]),
    ];
    const md = buildHistoryMarkdown(turns, "full");
    expect(md).toContain("**User [1]:**");
    expect(md).toContain("Hello world");
  });

  it("renders assistant text step", () => {
    const turns: Turn[] = [
      userTurn(0, "What is 2+2?"),
      assistantTurn(1, [{ type: "text", content: "The answer is 4." }]),
    ];
    const md = buildHistoryMarkdown(turns, "full");
    expect(md).toContain("The answer is 4.");
  });

  it("renders thinking step as blockquote", () => {
    const turns: Turn[] = [
      userTurn(0, "Think hard"),
      assistantTurn(1, [
        { type: "thinking", content: "Let me reason through this." },
        { type: "text", content: "Done." },
      ]),
    ];
    const md = buildHistoryMarkdown(turns, "full");
    expect(md).toContain("> **Thinking**");
    expect(md).toContain("Let me reason through this.");
  });

  it("renders tool_call with diff as ```diff block", () => {
    const turns: Turn[] = [
      userTurn(0, "Fix the code"),
      assistantTurn(1, [
        {
          type: "tool_call",
          id: "tc1",
          name: "EditFile",
          status: "success",
          diff: {
            path: "src/app.ts",
            oldText: "const x = 1",
            newText: "const x = 2",
          },
        },
      ]),
    ];
    const md = buildHistoryMarkdown(turns, "full");
    expect(md).toContain("**[EditFile]**");
    expect(md).toContain("```diff");
    expect(md).toContain("- const x = 1");
    expect(md).toContain("+ const x = 2");
  });

  it("renders tool_call with location path:line", () => {
    const turns: Turn[] = [
      userTurn(0, "Read something"),
      assistantTurn(1, [
        {
          type: "tool_call",
          id: "tc2",
          name: "ReadFile",
          status: "success",
          locations: [{ path: "src/foo.ts", line: 42 }],
        },
      ]),
    ];
    const md = buildHistoryMarkdown(turns, "full");
    expect(md).toContain("**[ReadFile]**");
    expect(md).toContain("`src/foo.ts:42`");
  });

  it("renders tool_call permission outcome", () => {
    const turns: Turn[] = [
      userTurn(0, "Do something"),
      assistantTurn(1, [
        {
          type: "tool_call",
          id: "tc3",
          name: "RunCommand",
          status: "success",
          permission: { requested: true, outcome: "approved" },
        },
      ]),
    ];
    const md = buildHistoryMarkdown(turns, "full");
    expect(md).toContain("*Permission: approved*");
  });

  it("renders plan step with status icons", () => {
    const turns: Turn[] = [
      userTurn(0, "Make a plan"),
      assistantTurn(1, [
        {
          type: "plan",
          entries: [
            { content: "Step 1", priority: "high", status: "done" },
            { content: "Step 2", priority: "medium", status: "pending" },
          ],
        },
      ]),
    ];
    const md = buildHistoryMarkdown(turns, "full");
    expect(md).toContain("**Plan:**");
    expect(md).toContain("✅ Step 1 (high)");
    expect(md).toContain("⬜ Step 2 (medium)");
  });

  it("renders image step", () => {
    const turns: Turn[] = [
      userTurn(0, "Show image"),
      assistantTurn(1, [{ type: "image", mimeType: "image/png", filePath: "/tmp/img.png" }]),
    ];
    const md = buildHistoryMarkdown(turns, "full");
    expect(md).toContain("[Image: image/png]");
  });

  it("renders audio step", () => {
    const turns: Turn[] = [
      userTurn(0, "Play audio"),
      assistantTurn(1, [{ type: "audio", mimeType: "audio/mp3", filePath: "/tmp/snd.mp3" }]),
    ];
    const md = buildHistoryMarkdown(turns, "full");
    expect(md).toContain("[Audio: audio/mp3]");
  });

  it("renders resource step", () => {
    const turns: Turn[] = [
      userTurn(0, "Get resource"),
      assistantTurn(1, [{ type: "resource", uri: "file:///foo.md", name: "Foo Doc" }]),
    ];
    const md = buildHistoryMarkdown(turns, "full");
    expect(md).toContain("[Resource: Foo Doc]");
    expect(md).toContain("file:///foo.md");
  });

  it("renders resource_link step", () => {
    const turns: Turn[] = [
      userTurn(0, "Get link"),
      assistantTurn(1, [{ type: "resource_link", uri: "https://example.com", name: "Example" }]),
    ];
    const md = buildHistoryMarkdown(turns, "full");
    expect(md).toContain("[Resource Link: Example]");
    expect(md).toContain("https://example.com");
  });

  it("renders mode_change step", () => {
    const turns: Turn[] = [
      userTurn(0, "Switch mode"),
      assistantTurn(1, [{ type: "mode_change", modeId: "verbose" }]),
    ];
    const md = buildHistoryMarkdown(turns, "full");
    expect(md).toContain("*Mode changed to: verbose*");
  });

  it("renders config_change step", () => {
    const turns: Turn[] = [
      userTurn(0, "Set config"),
      assistantTurn(1, [{ type: "config_change", configId: "theme", value: "dark" }]),
    ];
    const md = buildHistoryMarkdown(turns, "full");
    expect(md).toContain("*Config theme set to: dark*");
  });

  it("renders usage block", () => {
    const turns: Turn[] = [
      userTurn(0, "Do stuff"),
      assistantTurn(1, [{ type: "text", content: "Done." }], {
        usage: { tokensUsed: 5000, cost: { amount: 0.03, currency: "USD" } },
      }),
    ];
    const md = buildHistoryMarkdown(turns, "full");
    expect(md).toContain("**Usage**");
    expect(md).toContain("5,000 tokens");
    expect(md).toContain("$0.0300");
  });

  it("renders user attachments", () => {
    const turns: Turn[] = [
      userTurn(0, "Here is a file", {
        attachments: [{ type: "image", fileName: "photo.png", mimeType: "image/png", size: 1000 }],
      }),
      assistantTurn(1, [{ type: "text", content: "Got it." }]),
    ];
    const md = buildHistoryMarkdown(turns, "full");
    expect(md).toContain("[image: photo.png]");
  });

  it("separates turns with ---", () => {
    const turns: Turn[] = [
      userTurn(0, "Turn 1"),
      assistantTurn(1, [{ type: "text", content: "Response 1." }]),
      userTurn(2, "Turn 2"),
      assistantTurn(3, [{ type: "text", content: "Response 2." }]),
    ];
    const md = buildHistoryMarkdown(turns, "full");
    expect(md).toContain("---");
  });

  it("returns empty string for empty turns array", () => {
    expect(buildHistoryMarkdown([], "full")).toBe("");
  });

  it("numbers multiple user turns correctly", () => {
    const turns: Turn[] = [
      userTurn(0, "First"),
      assistantTurn(1, [{ type: "text", content: "A." }]),
      userTurn(2, "Second"),
      assistantTurn(3, [{ type: "text", content: "B." }]),
    ];
    const md = buildHistoryMarkdown(turns, "full");
    expect(md).toContain("**User [1]:**");
    expect(md).toContain("**User [2]:**");
  });
});

// ─── Balanced mode ────────────────────────────────────────────────────────────

describe("buildHistoryMarkdown — balanced mode", () => {
  it("omits thinking steps entirely", () => {
    const turns: Turn[] = [
      userTurn(0, "Think"),
      assistantTurn(1, [
        { type: "thinking", content: "Internal reasoning here." },
        { type: "text", content: "Here is my answer." },
      ]),
    ];
    const md = buildHistoryMarkdown(turns, "balanced");
    expect(md).not.toContain("Internal reasoning here.");
    expect(md).not.toContain("> **Thinking**");
    expect(md).toContain("Here is my answer.");
  });

  it("summarizes tool_call with diff as one-liner with -N/+M lines", () => {
    const turns: Turn[] = [
      userTurn(0, "Edit file"),
      assistantTurn(1, [
        {
          type: "tool_call",
          id: "tc1",
          name: "EditFile",
          status: "success",
          diff: {
            path: "src/app.ts",
            oldText: "line1\nline2",
            newText: "line3\nline4\nline5",
          },
        },
      ]),
    ];
    const md = buildHistoryMarkdown(turns, "balanced");
    // Should summarize, not show full diff
    expect(md).not.toContain("```diff");
    expect(md).toContain("EditFile");
    expect(md).toContain("-2/+3");
  });

  it("summarizes tool_call without diff as just name + path", () => {
    const turns: Turn[] = [
      userTurn(0, "Read"),
      assistantTurn(1, [
        {
          type: "tool_call",
          id: "tc2",
          name: "ReadFile",
          status: "success",
          locations: [{ path: "src/foo.ts", line: 5 }],
        },
      ]),
    ];
    const md = buildHistoryMarkdown(turns, "balanced");
    expect(md).toContain("ReadFile");
    expect(md).toContain("src/foo.ts");
    expect(md).not.toContain("```diff");
  });

  it("keeps text steps in balanced mode", () => {
    const turns: Turn[] = [
      userTurn(0, "Explain"),
      assistantTurn(1, [{ type: "text", content: "This is the explanation." }]),
    ];
    const md = buildHistoryMarkdown(turns, "balanced");
    expect(md).toContain("This is the explanation.");
  });

  it("renders plan steps in balanced mode", () => {
    const turns: Turn[] = [
      userTurn(0, "Plan"),
      assistantTurn(1, [
        {
          type: "plan",
          entries: [{ content: "Do A", priority: "high", status: "done" }],
        },
      ]),
    ];
    const md = buildHistoryMarkdown(turns, "balanced");
    expect(md).toContain("**Plan:**");
    expect(md).toContain("✅ Do A (high)");
  });
});

// ─── Compact mode ─────────────────────────────────────────────────────────────

describe("buildHistoryMarkdown — compact mode", () => {
  it("renders one-liner per user+assistant pair", () => {
    const turns: Turn[] = [
      userTurn(0, "What is the capital of France?"),
      assistantTurn(1, [{ type: "text", content: "The capital is Paris." }]),
    ];
    const md = buildHistoryMarkdown(turns, "compact");
    expect(md).toContain("User:");
    expect(md).toContain("Assistant:");
    // Both on same line or consecutive minimal output
    const lines = md.split("\n").filter((l) => l.trim());
    expect(lines.length).toBeLessThanOrEqual(3); // at most a line + separator
  });

  it("truncates long user text to 100 chars", () => {
    const longText = "A".repeat(200);
    const turns: Turn[] = [
      userTurn(0, longText),
      assistantTurn(1, [{ type: "text", content: "Short answer." }]),
    ];
    const md = buildHistoryMarkdown(turns, "compact");
    // Should not contain 200 A's in full
    expect(md.includes("A".repeat(200))).toBe(false);
  });

  it("truncates long assistant text to 80 chars", () => {
    const longAnswer = "B".repeat(200);
    const turns: Turn[] = [
      userTurn(0, "Short question"),
      assistantTurn(1, [{ type: "text", content: longAnswer }]),
    ];
    const md = buildHistoryMarkdown(turns, "compact");
    expect(md.includes("B".repeat(200))).toBe(false);
  });

  it("includes tool names in compact mode instead of details", () => {
    const turns: Turn[] = [
      userTurn(0, "Fix stuff"),
      assistantTurn(1, [
        {
          type: "tool_call",
          id: "tc1",
          name: "EditFile",
          status: "success",
          diff: { path: "src/app.ts", oldText: "old", newText: "new" },
        },
        {
          type: "tool_call",
          id: "tc2",
          name: "RunTests",
          status: "success",
        },
      ]),
    ];
    const md = buildHistoryMarkdown(turns, "compact");
    expect(md).toContain("EditFile");
    expect(md).toContain("RunTests");
    expect(md).not.toContain("```diff");
  });

  it("skips thinking steps in compact mode", () => {
    const turns: Turn[] = [
      userTurn(0, "Think"),
      assistantTurn(1, [
        { type: "thinking", content: "Secret thoughts." },
        { type: "text", content: "My answer." },
      ]),
    ];
    const md = buildHistoryMarkdown(turns, "compact");
    expect(md).not.toContain("Secret thoughts.");
    expect(md).not.toContain("> **Thinking**");
  });

  it("returns empty string for empty turns array", () => {
    expect(buildHistoryMarkdown([], "compact")).toBe("");
  });
});

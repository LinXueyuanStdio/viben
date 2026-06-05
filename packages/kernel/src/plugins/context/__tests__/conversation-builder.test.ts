import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  selectMode,
  parseJsonlToTurns,
  buildSessionMarkdown,
  mergeSessionsMarkdown,
  estimateTokens,
  type SessionMarkdownInput,
} from "../entire/conversation-builder.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURE_PATH = join(__dirname, "fixtures/short-session.jsonl");

// ─── selectMode ───────────────────────────────────────────────────────────────

describe("selectMode", () => {
  it("returns full for 1 turn", () => {
    expect(selectMode(1)).toBe("full");
  });

  it("returns full for exactly 10 turns", () => {
    expect(selectMode(10)).toBe("full");
  });

  it("returns balanced for 11 turns", () => {
    expect(selectMode(11)).toBe("balanced");
  });

  it("returns balanced for exactly 25 turns", () => {
    expect(selectMode(25)).toBe("balanced");
  });

  it("returns compact for 26 turns", () => {
    expect(selectMode(26)).toBe("compact");
  });

  it("returns compact for 100 turns", () => {
    expect(selectMode(100)).toBe("compact");
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

// ─── parseJsonlToTurns ────────────────────────────────────────────────────────

describe("parseJsonlToTurns", () => {
  const fixture = readFileSync(FIXTURE_PATH, "utf-8");

  it("parses the fixture into exactly 2 turns", () => {
    const result = parseJsonlToTurns(fixture);
    expect(result.turns).toHaveLength(2);
  });

  it("extracts correct user text for turn 1", () => {
    const result = parseJsonlToTurns(fixture);
    expect(result.turns[0].userText).toBe("fix the bug");
  });

  it("extracts correct user text for turn 2", () => {
    const result = parseJsonlToTurns(fixture);
    expect(result.turns[1].userText).toBe("now add tests");
  });

  it("skips tool_result-only user messages", () => {
    // The fixture has a user message with only tool_result (uuid u2a) — it should be skipped
    const result = parseJsonlToTurns(fixture);
    // Only 2 real turns (u1, u2), u2a is skipped
    expect(result.turns).toHaveLength(2);
  });

  it("extracts Edit tool as assistant part", () => {
    const result = parseJsonlToTurns(fixture);
    const turn1Parts = result.turns[0].assistantParts;
    const editPart = turn1Parts.find((p) => p.type === "edit");
    expect(editPart).toBeDefined();
    expect(editPart?.file).toBe("src/app.ts");
    expect(editPart?.old).toBe("const x = 1");
    expect(editPart?.new).toBe("const x = 2");
  });

  it("extracts Write tool as assistant part", () => {
    const result = parseJsonlToTurns(fixture);
    const turn2Parts = result.turns[1].assistantParts;
    const writePart = turn2Parts.find((p) => p.type === "write");
    expect(writePart).toBeDefined();
    expect(writePart?.file).toBe("src/app.test.ts");
    expect(writePart?.fileContent).toContain("vitest");
  });

  it("extracts text parts from assistant messages", () => {
    const result = parseJsonlToTurns(fixture);
    const textParts = result.turns[0].assistantParts.filter((p) => p.type === "text");
    expect(textParts.length).toBeGreaterThan(0);
    // Should include "Found the issue in app.ts." and/or "Fixed the variable."
    const allText = textParts.map((p) => p.content).join(" ");
    expect(allText).toContain("Found the issue");
  });

  it("extracts gitBranch from events", () => {
    const result = parseJsonlToTurns(fixture);
    expect(result.branch).toBe("main");
  });

  it("sets firstTimestamp and lastTimestamp to user turn timestamps", () => {
    const result = parseJsonlToTurns(fixture);
    expect(result.firstTimestamp).toBe("2026-03-15T18:53:00.000Z");
    expect(result.lastTimestamp).toBe("2026-03-15T18:54:00.000Z");
  });

  it("handles empty JSONL", () => {
    const result = parseJsonlToTurns("");
    expect(result.turns).toHaveLength(0);
    expect(result.branch).toBe("unknown");
    expect(result.firstTimestamp).toBe("");
    expect(result.lastTimestamp).toBe("");
  });

  it("handles invalid JSON lines gracefully", () => {
    const bad = `not-json\n{"type":"user","message":{"role":"user","content":"hello"},"timestamp":"2026-01-01T00:00:00Z","gitBranch":"main"}`;
    const result = parseJsonlToTurns(bad);
    expect(result.turns).toHaveLength(1);
    expect(result.turns[0].userText).toBe("hello");
  });

  it("skips skill prompt user messages", () => {
    const skillMsg = JSON.stringify({
      type: "user",
      message: { role: "user", content: "Base directory for this skill: /foo\n## Checklist\n## Process Flow\n## Key Principles\n" },
      timestamp: "2026-01-01T00:00:00Z",
      gitBranch: "main",
    });
    const result = parseJsonlToTurns(skillMsg);
    expect(result.turns).toHaveLength(0);
  });

  it("skips noise user messages (model switch)", () => {
    const noiseMsg = JSON.stringify({
      type: "user",
      message: { role: "user", content: "sonnet" },
      timestamp: "2026-01-01T00:00:00Z",
      gitBranch: "main",
    });
    const result = parseJsonlToTurns(noiseMsg);
    expect(result.turns).toHaveLength(0);
  });

  it("skips Read/Bash/Grep/Glob tool calls (not added as parts)", () => {
    const jsonl = [
      JSON.stringify({
        type: "user",
        message: { role: "user", content: "do stuff" },
        timestamp: "2026-01-01T00:00:00Z",
        gitBranch: "main",
      }),
      JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "tool_use", id: "r1", name: "Read", input: { file_path: "/foo.ts" } },
            { type: "tool_use", id: "b1", name: "Bash", input: { command: "ls" } },
            { type: "tool_use", id: "g1", name: "Grep", input: { pattern: "foo" } },
            { type: "text", text: "Done." },
          ],
        },
        timestamp: "2026-01-01T00:00:01Z",
        gitBranch: "main",
      }),
    ].join("\n");

    const result = parseJsonlToTurns(jsonl);
    expect(result.turns).toHaveLength(1);
    const parts = result.turns[0].assistantParts;
    expect(parts.every((p) => p.type === "text")).toBe(true);
    expect(parts.some((p) => p.file?.includes("foo.ts"))).toBe(false);
  });
});

// ─── buildSessionMarkdown ─────────────────────────────────────────────────────

describe("buildSessionMarkdown", () => {
  const fixture = readFileSync(FIXTURE_PATH, "utf-8");

  it("full mode: contains ```diff block for Edit", () => {
    const { turns } = parseJsonlToTurns(fixture);
    const md = buildSessionMarkdown(turns, "full");
    expect(md).toContain("```diff");
    expect(md).toContain("- const x = 1");
    expect(md).toContain("+ const x = 2");
  });

  it("full mode: contains full file content for Write", () => {
    const { turns } = parseJsonlToTurns(fixture);
    const md = buildSessionMarkdown(turns, "full");
    expect(md).toContain("```");
    expect(md).toContain("vitest");
  });

  it("compact mode: Edit renders as one-liner with ✏️", () => {
    const { turns } = parseJsonlToTurns(fixture);
    const md = buildSessionMarkdown(turns, "compact");
    expect(md).toContain("✏️");
    expect(md).toContain("src/app.ts");
    // Should NOT contain a diff block
    expect(md).not.toContain("```diff");
  });

  it("compact mode: Write renders as one-liner with 📝", () => {
    const { turns } = parseJsonlToTurns(fixture);
    const md = buildSessionMarkdown(turns, "compact");
    expect(md).toContain("📝");
    expect(md).toContain("lines written");
    // Should not show file content
    expect(md).not.toContain("vitest");
  });

  it("balanced mode: Edit shows truncated diff", () => {
    const { turns } = parseJsonlToTurns(fixture);
    const md = buildSessionMarkdown(turns, "balanced");
    expect(md).toContain("```diff");
  });

  it("labels user turns as **User [N]:**", () => {
    const { turns } = parseJsonlToTurns(fixture);
    const md = buildSessionMarkdown(turns, "full");
    expect(md).toContain("**User [1]:**");
    expect(md).toContain("**User [2]:**");
  });

  it("includes **Assistant:** label before assistant content", () => {
    const { turns } = parseJsonlToTurns(fixture);
    const md = buildSessionMarkdown(turns, "full");
    expect(md).toContain("**Assistant:**");
  });

  it("separates turns with ---", () => {
    const { turns } = parseJsonlToTurns(fixture);
    const md = buildSessionMarkdown(turns, "full");
    expect(md).toContain("---");
  });

  it("returns empty string for no turns", () => {
    const md = buildSessionMarkdown([], "full");
    expect(md).toBe("");
  });
});

// ─── mergeSessionsMarkdown ────────────────────────────────────────────────────

describe("mergeSessionsMarkdown", () => {
  const sessions: SessionMarkdownInput[] = [
    {
      markdown: "Session B content\n",
      startTime: "2026-03-15T19:00:00.000Z",
      endTime: "2026-03-15T19:30:00.000Z",
      agent: "claude",
      turns: 3,
      branch: "feature/b",
      files: ["b.ts"],
    },
    {
      markdown: "Session A content\n",
      startTime: "2026-03-15T18:00:00.000Z",
      endTime: "2026-03-15T18:30:00.000Z",
      agent: "claude",
      turns: 2,
      branch: "main",
      files: ["a.ts"],
    },
  ];

  it("sorts sessions chronologically (oldest first)", () => {
    const md = mergeSessionsMarkdown(sessions, "full", "my-repo");
    const idxA = md.indexOf("Session A content");
    const idxB = md.indexOf("Session B content");
    expect(idxA).toBeLessThan(idxB);
  });

  it("includes the title in the header", () => {
    const md = mergeSessionsMarkdown(sessions, "full", "my-repo");
    expect(md).toContain("# Conversation History from my-repo");
  });

  it("includes session count and total turns in header", () => {
    const md = mergeSessionsMarkdown(sessions, "compact", "my-repo");
    expect(md).toContain("2 sessions");
    expect(md).toContain("5 turns");
  });

  it("includes mode in header", () => {
    const md = mergeSessionsMarkdown(sessions, "balanced", "my-repo");
    expect(md).toContain("mode: balanced");
  });

  it("shows branch per session in section header", () => {
    const md = mergeSessionsMarkdown(sessions, "full", "my-repo");
    expect(md).toContain("branch: main");
    expect(md).toContain("branch: feature/b");
  });

  it("appends disclaimer at the end", () => {
    const md = mergeSessionsMarkdown(sessions, "full", "my-repo");
    expect(md).toContain("outdated information");
  });

  it("numbers sessions starting from 1", () => {
    const md = mergeSessionsMarkdown(sessions, "full", "my-repo");
    expect(md).toContain("Session Conversation History 1");
    expect(md).toContain("Session Conversation History 2");
  });
});

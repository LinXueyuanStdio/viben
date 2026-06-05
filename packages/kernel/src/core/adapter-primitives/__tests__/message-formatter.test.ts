import { describe, it, expect } from "vitest";
import {
  extractContentText,
  formatToolSummary,
  formatToolTitle,
  evaluateNoise,
} from "../message-formatter.js";

describe("extractContentText", () => {
  it("returns string content as-is", () => {
    expect(extractContentText("hello")).toBe("hello");
  });
  it("extracts text from ACP content block", () => {
    expect(extractContentText({ type: "text", text: "hello world" })).toBe(
      "hello world",
    );
  });
  it("handles nested content arrays", () => {
    const block = {
      content: [
        { type: "text", text: "a" },
        { type: "text", text: "b" },
      ],
    };
    expect(extractContentText(block)).toContain("a");
    expect(extractContentText(block)).toContain("b");
  });
  it("handles top-level array of content blocks", () => {
    const arr = [
      { type: "text", text: "hello" },
      { type: "text", text: "world" },
    ];
    expect(extractContentText(arr)).toBe("hello\nworld");
  });
  it("returns empty string for null/undefined", () => {
    expect(extractContentText(null)).toBe("");
    expect(extractContentText(undefined)).toBe("");
  });
  it("extracts input/output fields", () => {
    expect(extractContentText({ input: "some input" })).toBe("some input");
    expect(extractContentText({ output: "some output" })).toBe("some output");
  });
  it("recursively extracts non-string input/output", () => {
    expect(extractContentText({ input: { text: "nested input" } })).toBe(
      "nested input",
    );
    expect(extractContentText({ output: [{ text: "a" }, { text: "b" }] })).toBe(
      "a\nb",
    );
  });
  it("falls back to JSON.stringify for unrecognized objects", () => {
    const result = extractContentText({ foo: "bar", baz: 42 });
    expect(result).toContain("foo");
    expect(result).toContain("bar");
  });
  it("falls back to JSON.stringify for unrecognized objects", () => {
    const obj = { foo: "bar", count: 42 };
    const result = extractContentText(obj);
    expect(result).toContain('"foo"');
    expect(result).toContain('"bar"');
    expect(result).toContain("42");
  });

  it("respects depth limit", () => {
    let nested: Record<string, unknown> = { text: "deep" };
    for (let i = 0; i < 10; i++) nested = { content: nested };
    expect(extractContentText(nested).length).toBeLessThan(10);
  });
});

describe("formatToolSummary", () => {
  it("summarizes Read tool", () => {
    expect(
      formatToolSummary(
        "Read",
        JSON.stringify({ file_path: "src/main.ts", limit: 50 }),
      ),
    ).toBe("📖 Read src/main.ts (50 lines)");
  });
  it("summarizes Read tool without limit", () => {
    expect(
      formatToolSummary("Read", JSON.stringify({ file_path: "src/main.ts" })),
    ).toBe("📖 Read src/main.ts");
  });
  it("summarizes Bash tool", () => {
    expect(
      formatToolSummary("Bash", JSON.stringify({ command: "pnpm test" })),
    ).toBe("▶️ Run: pnpm test");
  });
  it("truncates long Bash commands", () => {
    const cmd = "a".repeat(100);
    const result = formatToolSummary("Bash", JSON.stringify({ command: cmd }));
    expect(result.length).toBeLessThan(80);
  });
  it("summarizes Edit tool", () => {
    expect(
      formatToolSummary("Edit", JSON.stringify({ file_path: "src/app.ts" })),
    ).toBe("✏️ Edit src/app.ts");
  });
  it("summarizes Write tool", () => {
    expect(
      formatToolSummary("Write", JSON.stringify({ file_path: "new-file.ts" })),
    ).toBe("📝 Write new-file.ts");
  });
  it("summarizes Grep tool", () => {
    expect(
      formatToolSummary(
        "Grep",
        JSON.stringify({ pattern: "TODO", path: "src/" }),
      ),
    ).toBe('🔍 Grep "TODO" in src/');
  });
  it("summarizes Glob tool", () => {
    expect(
      formatToolSummary("Glob", JSON.stringify({ pattern: "**/*.ts" })),
    ).toBe("🔍 Glob **/*.ts");
  });
  it("summarizes Agent tool", () => {
    expect(
      formatToolSummary(
        "Agent",
        JSON.stringify({ description: "Search codebase" }),
      ),
    ).toBe("🧠 Agent: Search codebase");
  });
  it("summarizes WebFetch tool", () => {
    expect(
      formatToolSummary(
        "WebFetch",
        JSON.stringify({ url: "https://api.example.com" }),
      ),
    ).toBe("🌐 Fetch https://api.example.com");
  });
  it("summarizes WebSearch tool", () => {
    expect(
      formatToolSummary(
        "WebSearch",
        JSON.stringify({ query: "react markdown" }),
      ),
    ).toBe('🌐 Search "react markdown"');
  });
  it("falls back for unknown tools", () => {
    expect(formatToolSummary("CustomTool", "{}")).toBe("🔧 CustomTool");
  });
  it("handles non-JSON content gracefully", () => {
    expect(formatToolSummary("Read", "some raw text")).toBe("🔧 Read");
  });
  it("handles object input (not just string)", () => {
    expect(formatToolSummary("Read", { file_path: "test.ts" })).toBe(
      "📖 Read test.ts",
    );
  });
  it("uses displaySummary when provided", () => {
    expect(
      formatToolSummary("read_file", {}, "📖 Read src/main.ts (50 lines)"),
    ).toBe("📖 Read src/main.ts (50 lines)");
  });
  it("falls back when displaySummary is empty string", () => {
    expect(formatToolSummary("Read", { file_path: "a.ts" }, "")).toBe(
      "📖 Read a.ts",
    );
  });
  it("falls back when displaySummary is non-string", () => {
    expect(
      formatToolSummary(
        "Read",
        { file_path: "a.ts" },
        123 as unknown as string,
      ),
    ).toBe("📖 Read a.ts");
  });
});

describe("formatToolTitle", () => {
  it("returns file path for Read tool", () => {
    expect(formatToolTitle("Read", { file_path: "src/main.ts" })).toBe(
      "src/main.ts",
    );
  });
  it("returns command for Bash tool", () => {
    expect(formatToolTitle("Bash", { command: "pnpm test" })).toBe("pnpm test");
  });
  it("returns pattern + path for Grep tool", () => {
    expect(formatToolTitle("Grep", { pattern: "TODO", path: "src/" })).toBe(
      '"TODO" in src/',
    );
  });
  it("returns tool name for unknown tools", () => {
    expect(formatToolTitle("CustomTool", {})).toBe("CustomTool");
  });
  it("returns tool name when rawInput is undefined", () => {
    expect(formatToolTitle("Read", undefined)).toBe("Read");
  });
  it("uses displayTitle when provided", () => {
    expect(formatToolTitle("read_file", {}, "src/main.ts")).toBe("src/main.ts");
  });
  it("falls back when displayTitle is empty string", () => {
    expect(formatToolTitle("Read", { file_path: "a.ts" }, "")).toBe("a.ts");
  });
  it("falls back when displayTitle is non-string", () => {
    expect(
      formatToolTitle("Read", { file_path: "a.ts" }, 42 as unknown as string),
    ).toBe("a.ts");
  });
});

describe("evaluateNoise", () => {
  it("hides ls tool", () => {
    expect(evaluateNoise("ls", "execute", {})).toBe("hide");
    expect(evaluateNoise("LS", "command", {})).toBe("hide");
  });
  it("hides directory reads (path ends with /)", () => {
    expect(evaluateNoise("Read", "read", { file_path: "src/" })).toBe("hide");
  });
  it("hides glob tool", () => {
    expect(evaluateNoise("Glob", "search", {})).toBe("hide");
  });
  it("hides grep tool", () => {
    expect(evaluateNoise("Grep", "search", {})).toBe("hide");
    expect(evaluateNoise("grep", "search", { pattern: "TODO" })).toBe("hide");
  });
  it("returns null for normal Read/Edit/Bash", () => {
    expect(
      evaluateNoise("Read", "read", { file_path: "src/main.ts" }),
    ).toBeNull();
    expect(
      evaluateNoise("Edit", "edit", { file_path: "src/main.ts" }),
    ).toBeNull();
    expect(
      evaluateNoise("Bash", "execute", { command: "pnpm test" }),
    ).toBeNull();
  });
  it("does not hide files without extension", () => {
    expect(evaluateNoise("Read", "read", { file_path: "Makefile" })).toBeNull();
    expect(
      evaluateNoise("Read", "read", { file_path: ".gitignore" }),
    ).toBeNull();
    expect(
      evaluateNoise("Read", "read", { file_path: "Dockerfile" }),
    ).toBeNull();
  });
});

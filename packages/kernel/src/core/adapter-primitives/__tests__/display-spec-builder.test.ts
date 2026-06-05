// src/core/adapter-primitives/__tests__/display-spec-builder.test.ts
import { describe, it, expect, vi } from "vitest";
import { DisplaySpecBuilder } from "../display-spec-builder.js";
import type { ToolEntry } from "../stream-accumulator.js";

function makeEntry(overrides: Partial<ToolEntry> = {}): ToolEntry {
  return {
    id: "t1",
    name: "Bash",
    kind: "execute",
    rawInput: { command: "pnpm build", description: "Build TypeScript" },
    content: "Done in 2.5s",
    status: "completed",
    isNoise: false,
    ...overrides,
  };
}

const builder = new DisplaySpecBuilder();

describe("DisplaySpecBuilder.buildToolSpec", () => {
  describe("low mode", () => {
    it("returns title only, no description, no command, no output", () => {
      const spec = builder.buildToolSpec(makeEntry(), "low");
      expect(spec.kind).toBe("execute");
      expect(spec.title).toBeTruthy();
      expect(spec.description).toBeNull();
      expect(spec.command).toBeNull();
      expect(spec.outputContent).toBeNull();
      expect(spec.outputSummary).toBeNull();
    });

    it("marks noise tools as hidden", () => {
      const spec = builder.buildToolSpec(makeEntry({ isNoise: true }), "low");
      expect(spec.isHidden).toBe(true);
    });

    it("does not hide noise tools on high", () => {
      const spec = builder.buildToolSpec(makeEntry({ isNoise: true }), "high");
      expect(spec.isHidden).toBe(false);
    });
  });

  describe("medium mode", () => {
    it("includes description and command for execute kind", () => {
      const spec = builder.buildToolSpec(makeEntry(), "medium");
      // title is "Build TypeScript" (from description), so description is deduped to null
      expect(spec.description).toBeNull();
      expect(spec.command).toBe("pnpm build");
    });

    it("includes outputSummary when content present", () => {
      const spec = builder.buildToolSpec(makeEntry({ content: "line1\nline2\nline3" }), "medium");
      expect(spec.outputSummary).toMatch(/3 lines/);
    });

    it("does not include inline outputContent (medium never inline)", () => {
      const spec = builder.buildToolSpec(makeEntry({ content: "short" }), "medium");
      expect(spec.outputContent).toBeNull();
    });
  });

  describe("high mode", () => {
    it("includes inline outputContent for short output (≤15 lines, ≤800 chars)", () => {
      const spec = builder.buildToolSpec(makeEntry({ content: "Done in 2.5s" }), "high");
      expect(spec.outputContent).toBe("Done in 2.5s");
    });

    it("does NOT include inline outputContent for long output (>15 lines)", () => {
      const longOutput = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n");
      const spec = builder.buildToolSpec(makeEntry({ content: longOutput }), "high");
      expect(spec.outputContent).toBeNull();
    });

    it("does NOT include inline outputContent for long output (>800 chars)", () => {
      const longOutput = "x".repeat(801);
      const spec = builder.buildToolSpec(makeEntry({ content: longOutput }), "high");
      expect(spec.outputContent).toBeNull();
    });

    it("includes inline outputContent at exactly 15 lines (boundary)", () => {
      const content = Array.from({ length: 15 }, (_, i) => `line ${i}`).join("\n");
      const spec = builder.buildToolSpec(makeEntry({ content }), "high");
      expect(spec.outputContent).toBe(content);
    });

    it("includes inline outputContent at exactly 800 chars (boundary)", () => {
      const content = "x".repeat(800);
      const spec = builder.buildToolSpec(makeEntry({ content }), "high");
      expect(spec.outputContent).toBe(content);
    });

    it("non-noise tool is never hidden regardless of mode", () => {
      expect(builder.buildToolSpec(makeEntry({ isNoise: false }), "low").isHidden).toBe(false);
      expect(builder.buildToolSpec(makeEntry({ isNoise: false }), "medium").isHidden).toBe(false);
      expect(builder.buildToolSpec(makeEntry({ isNoise: false }), "high").isHidden).toBe(false);
    });
  });

  describe("thought spec", () => {
    it("returns content null on low/medium", () => {
      expect(builder.buildThoughtSpec("thinking", "low").content).toBeNull();
      expect(builder.buildThoughtSpec("thinking", "medium").content).toBeNull();
    });

    it("returns content on high", () => {
      expect(builder.buildThoughtSpec("thinking hard", "high").content).toBe("thinking hard");
    });
  });

  describe("Read tool — no command field", () => {
    it("extracts description from rawInput.description when it differs from title", () => {
      const entry = makeEntry({
        name: "Read",
        kind: "read",
        rawInput: { file_path: "src/foo.ts", description: "Read foo" },
      });
      const spec = builder.buildToolSpec(entry, "medium");
      // title is "src/foo.ts" (from file_path), description "Read foo" differs → kept
      expect(spec.description).toBe("Read foo");
      expect(spec.command).toBeNull();
    });
  });

  describe("diffStats", () => {
    it("includes diffStats from entry on medium+", () => {
      const entry = makeEntry({ diffStats: { added: 10, removed: 3 } });
      const spec = builder.buildToolSpec(entry, "medium");
      expect(spec.diffStats).toEqual({ added: 10, removed: 3 });
    });

    it("diffStats is null on low", () => {
      const entry = makeEntry({ diffStats: { added: 10, removed: 3 } });
      const spec = builder.buildToolSpec(entry, "low");
      expect(spec.diffStats).toBeNull();
    });
  });

  describe("noise tools hidden on medium mode", () => {
    it("noise tools hidden on medium mode", () => {
      const spec = builder.buildToolSpec(makeEntry({ isNoise: true }), "medium");
      expect(spec.isHidden).toBe(true);
    });
  });

  describe("viewerLinks passthrough", () => {
    const links = { file: "https://example.com/file", diff: "https://example.com/diff" };

    it("viewerLinks always passed through on low mode", () => {
      const spec = builder.buildToolSpec(makeEntry({ viewerLinks: links }), "low");
      expect(spec.viewerLinks).toEqual(links);
    });

    it("viewerLinks always passed through on medium mode", () => {
      const spec = builder.buildToolSpec(makeEntry({ viewerLinks: links }), "medium");
      expect(spec.viewerLinks).toEqual(links);
    });

    it("viewerLinks always passed through on high mode", () => {
      const spec = builder.buildToolSpec(makeEntry({ viewerLinks: links }), "high");
      expect(spec.viewerLinks).toEqual(links);
    });
  });

  describe("tunnel and fallback paths", () => {
    const longContent = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n");
    const sessionContext = { id: "sess-1", workingDirectory: "/tmp" };

    function mockTunnelService(publicUrl = "https://tunnel.example.com") {
      return {
        getPublicUrl: vi.fn().mockReturnValue(publicUrl),
        start: vi.fn(),
        stop: vi.fn(),
        getStore: vi.fn().mockReturnValue({
          storeFile: vi.fn(),
          storeDiff: vi.fn(),
          storeOutput: vi.fn().mockReturnValue("output-id-1"),
        }),
        fileUrl: vi.fn(),
        diffUrl: vi.fn(),
        outputUrl: vi.fn().mockReturnValue("https://tunnel.example.com/output/output-id-1"),
      };
    }

    it("tunnel available + long output on medium mode sets outputViewerLink", () => {
      const tunnel = mockTunnelService();
      const tunnelBuilder = new DisplaySpecBuilder(tunnel as any);
      const spec = tunnelBuilder.buildToolSpec(makeEntry({ content: longContent }), "medium", sessionContext);
      expect(spec.outputViewerLink).toBe("https://tunnel.example.com/output/output-id-1");
    });

    it("no tunnel + high mode sets outputFallbackContent", () => {
      const noTunnelBuilder = new DisplaySpecBuilder();
      const spec = noTunnelBuilder.buildToolSpec(makeEntry({ content: longContent }), "high", sessionContext);
      expect(spec.outputFallbackContent).toBe(longContent);
    });

    it("no tunnel + medium mode: no fallback, no viewer link", () => {
      const noTunnelBuilder = new DisplaySpecBuilder();
      const spec = noTunnelBuilder.buildToolSpec(makeEntry({ content: longContent }), "medium", sessionContext);
      expect(spec.outputFallbackContent).toBeUndefined();
      expect(spec.outputViewerLink).toBeUndefined();
    });
  });

  describe("inline boundary tests", () => {
    it("content at exactly 15 lines and 800 chars is inline on high", () => {
      // Build content that is exactly 15 lines and exactly 800 chars total
      // 15 lines means 14 newline characters. 800 - 14 = 786 chars of text across 15 lines.
      // Each line: 786 / 15 = 52.4, so 14 lines of 53 chars + 1 line of 44 chars = 14*53 + 44 = 742 + 44 = 786
      const lines = Array.from({ length: 14 }, () => "x".repeat(53));
      lines.push("x".repeat(44));
      const content = lines.join("\n");
      expect(content.split("\n").length).toBe(15);
      expect(content.length).toBe(800);
      const spec = builder.buildToolSpec(makeEntry({ content }), "high");
      expect(spec.outputContent).toBe(content);
    });

    it("content at 16 lines (one over) is NOT inline", () => {
      const content = Array.from({ length: 16 }, (_, i) => `line${i}`).join("\n");
      expect(content.split("\n").length).toBe(16);
      const spec = builder.buildToolSpec(makeEntry({ content }), "high");
      expect(spec.outputContent).toBeNull();
    });

    it("content at 15 lines but >800 chars is NOT inline", () => {
      // 15 lines with enough chars per line to exceed 800 total
      // 14 newlines + text. Need text > 786 chars across 15 lines.
      const lines = Array.from({ length: 15 }, () => "x".repeat(53));
      lines[14] = "x".repeat(45); // 14*53 + 45 = 742 + 45 = 787 text + 14 newlines = 801
      const content = lines.join("\n");
      expect(content.split("\n").length).toBe(15);
      expect(content.length).toBe(801);
      const spec = builder.buildToolSpec(makeEntry({ content }), "high");
      expect(spec.outputContent).toBeNull();
    });
  });

  describe("empty and null content edge cases", () => {
    it("empty content produces null outputSummary", () => {
      const spec = builder.buildToolSpec(makeEntry({ content: "" }), "medium");
      expect(spec.outputSummary).toBeNull();
    });

    it("whitespace-only content produces null outputSummary", () => {
      const spec = builder.buildToolSpec(makeEntry({ content: "   \n  " }), "medium");
      expect(spec.outputSummary).toBeNull();
    });

    it("null content on medium mode produces null outputSummary", () => {
      const spec = builder.buildToolSpec(makeEntry({ content: null as any }), "medium");
      expect(spec.outputSummary).toBeNull();
    });
  });

  describe("thought spec extended", () => {
    it("buildThoughtSpec includes indicator string 'Thinking...'", () => {
      const spec = builder.buildThoughtSpec("deep thought", "high");
      expect(spec.indicator).toBe("Thinking...");
    });

    it("buildThoughtSpec on low mode has null content but has indicator", () => {
      const spec = builder.buildThoughtSpec("deep thought", "low");
      expect(spec.content).toBeNull();
      expect(spec.indicator).toBe("Thinking...");
    });
  });

  describe("output summary pluralization", () => {
    it("outputSummary says '1 line of output' for single-line content", () => {
      const spec = builder.buildToolSpec(makeEntry({ content: "single line" }), "medium");
      expect(spec.outputSummary).toBe("1 line of output");
    });

    it("outputSummary says 'N lines of output' for multi-line", () => {
      const content = "line1\nline2\nline3\nline4\nline5";
      const spec = builder.buildToolSpec(makeEntry({ content }), "medium");
      expect(spec.outputSummary).toBe("5 lines of output");
    });
  });

  describe("title generation for different tool kinds", () => {
    it("read tool title supports camelCase filePath", () => {
      const entry = makeEntry({
        name: "read",
        kind: "read",
        rawInput: { filePath: "/foo/bar.ts", offset: 1, limit: 10 },
      });
      const spec = builder.buildToolSpec(entry, "medium");
      expect(spec.title).toBe("/foo/bar.ts (lines 1–10)");
    });

    it("edit tool title from file_path", () => {
      const entry = makeEntry({
        name: "Edit",
        kind: "edit",
        rawInput: { file_path: "/foo/bar.ts" },
      });
      const spec = builder.buildToolSpec(entry, "medium");
      expect(spec.title).toBe("/foo/bar.ts");
    });

    it("execute tool title from command (truncated at 60 chars)", () => {
      const longCommand = "a".repeat(70);
      const entry = makeEntry({
        name: "Bash",
        kind: "execute",
        rawInput: { command: longCommand },
      });
      const spec = builder.buildToolSpec(entry, "medium");
      expect(spec.title).toBe("a".repeat(57) + "...");
    });

    it("read tool title with start_line and end_line", () => {
      const entry = makeEntry({
        name: "Read",
        kind: "read",
        rawInput: { file_path: "foo.ts", start_line: 5, end_line: 10 },
      });
      const spec = builder.buildToolSpec(entry, "medium");
      expect(spec.title).toBe("foo.ts (lines 5\u201310)");
    });

    it("search tool title with pattern and glob", () => {
      const entry = makeEntry({
        name: "Grep",
        kind: "search",
        rawInput: { pattern: "foo", glob: "*.ts" },
      });
      const spec = builder.buildToolSpec(entry, "medium");
      expect(spec.title).toContain("foo");
      expect(spec.title).toContain("*.ts");
    });

    it("apply_patch title extracts updated file path when kind is other", () => {
      const entry = makeEntry({
        name: "apply_patch",
        kind: "other",
        rawInput: {
          patchText:
            "*** Begin Patch\n*** Update File: /repo/src/app.ts\n@@\n-foo\n+bar\n*** End Patch",
        },
      });
      const spec = builder.buildToolSpec(entry, "medium");
      expect(spec.title).toBe("/repo/src/app.ts");
      expect(spec.kind).toBe("edit");
      expect(spec.icon).toBe("✏️");
    });

    it("todowrite title summarizes progress when kind is other", () => {
      const entry = makeEntry({
        name: "todowrite",
        kind: "other",
        rawInput: {
          todos: [
            { content: "A", status: "completed", priority: "high" },
            { content: "B", status: "in_progress", priority: "medium" },
            { content: "C", status: "pending", priority: "low" },
          ],
        },
      });
      const spec = builder.buildToolSpec(entry, "medium");
      expect(spec.title).toBe("Todo list (1/3 done, 1 active)");
    });

    it("keeps raw paths in title and exposes workingDirectory", () => {
      const ctx = { id: "sess-1", workingDirectory: "/repo" };

      const readSpec = builder.buildToolSpec(
        makeEntry({
          name: "read",
          kind: "read",
          rawInput: { filePath: "/repo/src/a.ts", offset: 10, limit: 5 },
        }),
        "medium",
        ctx,
      );
      expect(readSpec.title).toBe("/repo/src/a.ts (lines 10–14)");
      expect(readSpec.workingDirectory).toBe("/repo");

      const writeSpec = builder.buildToolSpec(
        makeEntry({
          name: "write",
          kind: "write",
          rawInput: { filePath: "/repo/lib/output.json" },
        }),
        "medium",
        ctx,
      );
      expect(writeSpec.title).toBe("/repo/lib/output.json");

      const patchSpec = builder.buildToolSpec(
        makeEntry({
          name: "apply_patch",
          kind: "other",
          rawInput: {
            patchText:
              "*** Begin Patch\n*** Update File: /repo/packages/a/src/index.ts\n*** End Patch",
          },
        }),
        "medium",
        ctx,
      );
      expect(patchSpec.title).toBe("/repo/packages/a/src/index.ts");
    });

    it("apply_patch multi-file title shows first two raw paths", () => {
      const spec = builder.buildToolSpec(
        makeEntry({
          name: "apply_patch",
          kind: "other",
          rawInput: {
            patchText:
              "*** Begin Patch\n*** Update File: /repo/a/one.ts\n*** Update File: /repo/b/two.ts\n*** Update File: /repo/c/three.ts\n*** End Patch",
          },
        }),
        "medium",
        { id: "sess-1", workingDirectory: "/repo" },
      );
      expect(spec.title).toBe("/repo/a/one.ts, /repo/b/two.ts (+1 more)");
    });
  });
});

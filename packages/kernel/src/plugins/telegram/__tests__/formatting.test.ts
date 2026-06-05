import { describe, it, expect } from "vitest";
import { formatUsage, renderToolCard, splitToolCardText } from "../formatting.js";
import type { ToolCardSnapshot } from "../../../core/adapter-primitives/primitives/tool-card-state.js";
import type { ToolDisplaySpec } from "../../../core/adapter-primitives/display-spec-builder.js";

function makeSpec(overrides: Partial<ToolDisplaySpec> = {}): ToolDisplaySpec {
  return {
    id: "t1",
    kind: "read",
    icon: "📖",
    title: "Read foo.ts",
    description: null,
    command: null,
    outputSummary: null,
    outputContent: null,
    diffStats: null,
    status: "completed",
    isNoise: false,
    isHidden: false,
    ...overrides,
  };
}

function makeSnap(specs: ToolDisplaySpec[], extra: Partial<ToolCardSnapshot> = {}): ToolCardSnapshot {
  const visible = specs.filter((s) => !s.isHidden);
  const done = visible.filter((s) => ["completed", "done", "failed", "error"].includes(s.status)).length;
  return {
    specs,
    totalVisible: visible.length,
    completedVisible: done,
    allComplete: visible.length > 0 && done === visible.length,
    ...extra,
  };
}

describe("formatUsage", () => {
  it("shows progress bar with tokens and contextSize (high)", () => {
    // 28k/200k = 14%, Math.round(0.14 * 10) = 1 filled block
    const result = formatUsage(
      { tokensUsed: 28000, contextSize: 200000 },
      "high",
    );
    expect(result).toBe("📊 28k / 200k tokens\n▓░░░░░░░░░ 14%");
  });

  it("shows warning emoji when usage >= 85% (high)", () => {
    const result = formatUsage(
      { tokensUsed: 85000, contextSize: 100000 },
      "high",
    );
    expect(result).toBe("⚠️ 85k / 100k tokens\n▓▓▓▓▓▓▓▓▓░ 85%");
  });

  it("shows warning emoji at exactly 85% (high)", () => {
    const result = formatUsage(
      { tokensUsed: 8500, contextSize: 10000 },
      "high",
    );
    expect(result).toContain("⚠️");
  });

  it("shows 100% with full bar (high)", () => {
    const result = formatUsage(
      { tokensUsed: 100000, contextSize: 100000 },
      "high",
    );
    expect(result).toBe("⚠️ 100k / 100k tokens\n▓▓▓▓▓▓▓▓▓▓ 100%");
  });

  it("shows only tokens when no contextSize", () => {
    const result = formatUsage({ tokensUsed: 5000 });
    expect(result).toBe("📊 5k tokens");
  });

  it("shows placeholder when no data", () => {
    const result = formatUsage({});
    expect(result).toBe("📊 Usage data unavailable");
  });

  it("displays small numbers without k suffix (high)", () => {
    const result = formatUsage({ tokensUsed: 500, contextSize: 1000 }, "high");
    expect(result).toBe("📊 500 / 1k tokens\n▓▓▓▓▓░░░░░ 50%");
  });
});

describe("renderToolCard from ToolDisplaySpec[]", () => {
  it("renders icon + title for low-mode spec (no description)", () => {
    const snap = makeSnap([makeSpec({ title: "Read foo.ts" })]);
    const html = renderToolCard(snap);
    expect(html).toContain("📖");
    expect(html).toContain("Read foo.ts");
  });

  it("renders description on medium spec", () => {
    const snap = makeSnap([makeSpec({ description: "List files", status: "completed" })]);
    const html = renderToolCard(snap);
    expect(html).toContain("List files");
  });

  it("renders command on medium spec", () => {
    const snap = makeSnap([makeSpec({ command: "pnpm build", status: "completed" })]);
    const html = renderToolCard(snap);
    expect(html).toContain("pnpm build");
  });

  it("renders outputSummary on medium spec", () => {
    const snap = makeSnap([makeSpec({ outputSummary: "47 lines of output", status: "completed" })]);
    const html = renderToolCard(snap);
    expect(html).toContain("47 lines of output");
  });

  it("renders outputContent inline on high spec", () => {
    const snap = makeSnap([makeSpec({ outputContent: "Done in 2.5s", status: "completed" })]);
    const html = renderToolCard(snap);
    expect(html).toContain("Done in 2.5s");
  });

  it("renders viewer link buttons", () => {
    const spec = makeSpec({ viewerLinks: { file: "https://t.me/view/123" }, status: "completed" });
    const html = renderToolCard(makeSnap([spec]));
    expect(html).toContain("https://t.me/view/123");
  });

  it("does not render hidden specs", () => {
    const snap = makeSnap([makeSpec({ isHidden: true, title: "HiddenTool" })]);
    const html = renderToolCard(snap);
    expect(html).not.toContain("HiddenTool");
  });

  it("renders diffStats on medium spec", () => {
    const spec = makeSpec({ diffStats: { added: 10, removed: 3 }, status: "completed" });
    const html = renderToolCard(makeSnap([spec]));
    expect(html).toContain("+10");
  });
});

describe("splitToolCardText — single section > 4096 fix", () => {
  it("handles single section larger than 4096 chars", () => {
    const bigSection = "x".repeat(5000);
    const chunks = splitToolCardText(bigSection);
    expect(chunks.length).toBe(1);
    expect(chunks[0].length).toBeLessThanOrEqual(4096);
    expect(chunks[0]).toMatch(/\.\.\.$/);
  });

  it("splits at section boundaries before hitting limit", () => {
    const section1 = "A".repeat(3000);
    const section2 = "B".repeat(3000);
    const text = `${section1}\n\n${section2}`;
    const chunks = splitToolCardText(text);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toBe(section1);
    expect(chunks[1]).toBe(section2);
  });
});

describe("splitToolCardText — HTML tag safety", () => {
  it("does not split inside a <code> block even when it contains \\n\\n", () => {
    // Command with a blank line inside — must not split the <code> block
    const command = "line1\n\nline2";
    const section = `✅ <b>Run</b> · title\n   <code>${command}</code>`;
    // Pad with previous sections to push total over 4096
    const padding = "P".repeat(3900);
    const text = `${padding}\n\n${section}`;
    const chunks = splitToolCardText(text);
    // The section containing <code>...</code> must stay in one chunk
    const codeChunk = chunks.find((c) => c.includes("<code>"));
    expect(codeChunk).toBeDefined();
    expect(codeChunk).toContain("</code>");
  });

  it("closes unclosed <code> tag when a large section is truncated", () => {
    // A section starting with <code> that is large enough to be truncated
    const section = `<code>${"x".repeat(5000)}</code>`;
    const chunks = splitToolCardText(section);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toMatch(/<\/code>$/);
    expect(chunks[0].length).toBeLessThanOrEqual(4096);
  });

  it("closes unclosed tags when chunk boundary falls inside a <code> block", () => {
    // Two tool entries: first fills up near 4096, second has <code> with \n\n
    const bigFirst = "A".repeat(3800);
    // Second entry: <code> block split by \n\n; combined entry > remaining space
    const secondEntry =
      "✅ <b>Run</b> · Check\n   <code>" + "B".repeat(200) + "\n\n" + "C".repeat(200) + "</code>";
    const text = `${bigFirst}\n\n${secondEntry}`;
    const chunks = splitToolCardText(text);
    // Every chunk must have balanced HTML tags
    for (const chunk of chunks) {
      const openTags = [...chunk.matchAll(/<code>/gi)].length;
      const closeTags = [...chunk.matchAll(/<\/code>/gi)].length;
      expect(openTags).toBe(closeTags);
    }
  });
});

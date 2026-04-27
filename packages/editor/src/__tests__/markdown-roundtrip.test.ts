/**
 * Editor-level markdown roundtrip tests.
 *
 * Verifies the contract: markdown ≈ serializeMarkdown(editor, deserializeMarkdown(editor, markdown))
 *
 * These tests create a real YooEditor with the full plugin set and run
 * deserialize → serialize through the wrapper in markdown.ts.
 *
 * Tests are organized into:
 * 1. Exact roundtrip — output === input (lossless)
 * 2. Idempotent roundtrip — f(f(x)) === f(x) (stable after first pass)
 * 3. Upstream known issues — tests that SHOULD pass but fail due to @yoopta bugs
 * 4. Frontmatter preservation
 * 5. Special preprocessing (TOC, math)
 * 6. Real-world SKILL.md content
 * 7. Structural preservation (block count)
 * 8. Edge cases
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  createYooptaEditor,
  type YooEditor,
  type YooptaPlugin,
  type SlateElement,
} from "@yoopta/editor";
import { HeadingOne, HeadingTwo, HeadingThree } from "@yoopta/headings";
import Paragraph from "@yoopta/paragraph";
import Blockquote from "@yoopta/blockquote";
import Callout from "@yoopta/callout";
import { BulletedList, NumberedList, TodoList } from "@yoopta/lists";
import Code from "@yoopta/code";
import Divider from "@yoopta/divider";
import Link from "@yoopta/link";
import Table from "@yoopta/table";
import Image from "@yoopta/image";
import Embed from "@yoopta/embed";

import { deserializeMarkdown, serializeMarkdown } from "../markdown";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLUGINS = [
  Paragraph,
  HeadingOne,
  HeadingTwo,
  HeadingThree,
  Blockquote,
  Callout,
  BulletedList,
  NumberedList,
  TodoList,
  Code.Code,
  Divider,
  Link,
  Table,
  Image,
  Embed,
];

function createTestEditor(): YooEditor {
  return createYooptaEditor({
    plugins: PLUGINS as unknown as YooptaPlugin<
      Record<string, SlateElement>,
      unknown
    >[],
  });
}

/** md → blocks → md */
function roundtrip(editor: YooEditor, md: string): string {
  const { value, frontmatter } = deserializeMarkdown(editor, md);
  return serializeMarkdown(editor, value, frontmatter);
}

/** Two consecutive roundtrips. Idempotency ⇔ first === second. */
function doubleRoundtrip(
  editor: YooEditor,
  md: string,
): { first: string; second: string } {
  const first = roundtrip(editor, md);
  const second = roundtrip(editor, first);
  return { first, second };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let editor: YooEditor;

beforeAll(() => {
  editor = createTestEditor();
});

// =============================================================================
// 1. Exact roundtrip — output === input
// =============================================================================

describe("exact roundtrip (output === input)", () => {
  const cases: [string, string][] = [
    ["simple paragraph", "Hello world"],
    ["heading h1", "# Heading One"],
    ["heading h2", "## Heading Two"],
    ["heading h3", "### Heading Three"],
    ["multiple headings", "# H1\n\n## H2\n\n### H3"],
    ["heading + paragraph", "# Title\n\nSome content here."],
    ["bulleted list", "- Item 1\n- Item 2\n- Item 3"],
    [
      "paragraph + bulleted list",
      "A paragraph.\n\n- Item 1\n- Item 2\n- Item 3",
    ],
    ["bold text", "This is **bold** text."],
    ["italic text", "This is *italic* text."],
    ["inline code", "Use `const x = 1` in code."],
    ["mixed inline marks", "Use **bold**, *italic*, and `code` together."],
    ["link in paragraph", "Visit [Google](https://google.com) for search."],
    ["image", "![alt text](https://example.com/image.png)"],
    ["divider", "---"],
    [
      "heading + paragraph + list",
      "# Title\n\nIntro paragraph.\n\n- Item A\n- Item B",
    ],
    [
      "table",
      "| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |",
    ],
  ];

  for (const [name, input] of cases) {
    it(name, () => {
      const output = roundtrip(editor, input);
      expect(output).toBe(input);
    });
  }
});

// =============================================================================
// 2. Idempotent roundtrip — f(f(x)) === f(x)
//
// Even if the first roundtrip changes the input (upstream normalization),
// a second roundtrip must produce the same output as the first.
// =============================================================================

describe("idempotent roundtrip (f(f(x)) === f(x))", () => {
  const cases: [string, string][] = [
    ["simple paragraph", "Hello world"],
    ["heading h1", "# Heading One"],
    ["heading + paragraph", "# Title\n\nSome content here."],
    ["bulleted list", "- Item 1\n- Item 2\n- Item 3"],
    [
      "numbered list (upstream normalizes counters to 1.)",
      "1. First\n2. Second\n3. Third",
    ],
    ["todo list", "- [ ] Todo 1\n- [x] Done"],
    [
      "code block",
      "```javascript\nconst x = 1;\nconsole.log(x);\n```",
    ],
    [
      "code block without language",
      "```\nplain code\n```",
    ],
    ["divider", "---"],
    ["bold text", "This is **bold** text."],
    ["italic text", "This is *italic* text."],
    ["inline code", "Use `const x = 1` in code."],
    ["link", "Visit [Google](https://google.com) for search."],
    ["image", "![alt text](https://example.com/image.png)"],
    [
      "table",
      "| A | B |\n| --- | --- |\n| 1 | 2 |",
    ],
  ];

  for (const [name, input] of cases) {
    it(name, () => {
      const { first, second } = doubleRoundtrip(editor, input);
      expect(second).toBe(first);
    });
  }
});

// =============================================================================
// 3. Upstream known issues (@yoopta bugs)
//
// These tests document bugs in @yoopta/exports that break roundtrip.
// They are marked with `it.fails` so CI stays green, but the failures are
// visible. When upstream fixes land, these tests will start passing and
// `it.fails` will alert us to remove the annotation.
// =============================================================================

describe("upstream known issues", () => {
  // @yoopta/blockquote serialize adds an extra leading space on every roundtrip.
  // Input "> quote" → first pass ">  quote " → second pass ">   quote  " (diverges)
  it.fails("blockquote idempotency (upstream adds extra space each roundtrip)", () => {
    const { first, second } = doubleRoundtrip(editor, "> This is a quote");
    expect(second).toBe(first);
  });

  // Mixed content containing a blockquote also diverges due to the same bug.
  it.fails("mixed content with blockquote idempotency", () => {
    const md = [
      "# Title",
      "",
      "Intro paragraph with **bold** and *italic*.",
      "",
      "- Bullet A",
      "- Bullet B",
      "",
      "1. First",
      "2. Second",
      "",
      "> A blockquote",
      "",
      "```js",
      "const x = 42;",
      "```",
      "",
      "---",
      "",
      "Final paragraph.",
    ].join("\n");
    const { first, second } = doubleRoundtrip(editor, md);
    expect(second).toBe(first);
  });

  // Blockquote exact roundtrip also fails — upstream adds trailing space.
  it.fails("blockquote exact roundtrip (upstream adds trailing/leading spaces)", () => {
    const output = roundtrip(editor, "> This is a quote");
    expect(output).toBe("> This is a quote");
  });
});

// =============================================================================
// 4. Frontmatter preservation
// =============================================================================

describe("frontmatter preservation through roundtrip", () => {
  it("preserves YAML frontmatter", () => {
    const md = [
      "---",
      "title: Test Page",
      "type: markdown",
      "---",
      "# Hello",
      "",
      "Content here.",
    ].join("\n");
    const output = roundtrip(editor, md);
    expect(output).toBe(md);
  });

  it("preserves frontmatter with array values", () => {
    const md = [
      "---",
      "page:",
      "  type: markdown",
      "  permission: [read, write]",
      "name: test",
      "---",
      "# Test",
      "",
      "Body text.",
    ].join("\n");
    const output = roundtrip(editor, md);
    expect(output).toBe(md);
  });

  it("preserves frontmatter with block-style YAML list", () => {
    const md = [
      "---",
      "page:",
      "  type: markdown",
      "  permission:",
      "    - read",
      "    - write",
      "icon:",
      "  type: lucide",
      "  value: book",
      "name: heart",
      "---",
      "# Heart",
    ].join("\n");
    const output = roundtrip(editor, md);
    expect(output).toBe(md);
  });

  it("handles markdown without frontmatter", () => {
    const md = "# No Frontmatter\n\nJust content.";
    const output = roundtrip(editor, md);
    expect(output).toBe(md);
  });

  it("idempotent with frontmatter", () => {
    const md = [
      "---",
      "page:",
      "  type: markdown",
      "  permission: [read, write]",
      "name: openclaw",
      "description: openclaw page",
      "---",
      "# Channels",
      "",
      "Some text here.",
      "",
      "- Item A",
      "- Item B",
    ].join("\n");
    const { first, second } = doubleRoundtrip(editor, md);
    expect(second).toBe(first);
  });
});

// =============================================================================
// 5. Special preprocessing structures (TOC, math)
// =============================================================================

describe("special preprocessing structures", () => {
  it("[TOC] roundtrip is idempotent", () => {
    const md = "[TOC]\n\n# Section 1\n\nContent.";
    const { first, second } = doubleRoundtrip(editor, md);
    expect(second).toBe(first);
  });

  it("math block $$ roundtrip is idempotent", () => {
    const md = "$$\nE = mc^2\n$$";
    const { first, second } = doubleRoundtrip(editor, md);
    expect(second).toBe(first);
  });

  it("inline math $ roundtrip is idempotent", () => {
    const md = "The formula $E = mc^2$ is famous.";
    const { first, second } = doubleRoundtrip(editor, md);
    expect(second).toBe(first);
  });

  it("mixed [TOC] + math is idempotent", () => {
    const md = [
      "[TOC]",
      "",
      "# Math Section",
      "",
      "Inline: $a^2 + b^2 = c^2$",
      "",
      "$$",
      "\\int_0^\\infty e^{-x} dx = 1",
      "$$",
    ].join("\n");
    const { first, second } = doubleRoundtrip(editor, md);
    expect(second).toBe(first);
  });

  it("frontmatter + [TOC] + math is idempotent", () => {
    const md = [
      "---",
      "page:",
      "  type: markdown",
      "---",
      "[TOC]",
      "",
      "# Title",
      "",
      "$$",
      "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
      "$$",
    ].join("\n");
    const { first, second } = doubleRoundtrip(editor, md);
    expect(second).toBe(first);
  });
});

// =============================================================================
// 6. Real-world SKILL.md files
// =============================================================================

describe("real-world SKILL.md roundtrip", () => {
  it("minimal page (heading + paragraph)", () => {
    const md = [
      "---",
      "page:",
      "  type: markdown",
      "  permission: [read, write]",
      'name: "first"',
      'description: "first page"',
      "---",
      "",
      "# First",
      "",
      "Page description here.",
    ].join("\n");
    const { first, second } = doubleRoundtrip(editor, md);
    expect(second).toBe(first);
  });

  it("complex page with Chinese text and multiple sections", () => {
    const md = [
      "---",
      "page:",
      "  type: markdown",
      "  permission: [read, write]",
      'name: "openclaw"',
      'description: "openclaw page"',
      "---",
      "# Channels",
      "",
      "本周最小优先集：Whatsapp，Telegram，Feishu，WebChat",
      "",
      "# Providers, Models",
      "",
      "工坊 AIME provider",
      "",
      "# Tools",
      "",
      "built-in 工具：",
      "",
      "- exec / process",
      "- code_execution",
      "- read / write / edit",
    ].join("\n");
    const { first, second } = doubleRoundtrip(editor, md);
    expect(second).toBe(first);
  });
});

// =============================================================================
// 7. Structural preservation — block count survives roundtrip
// =============================================================================

describe("structural preservation (block count survives roundtrip)", () => {
  const structureCases: [string, string, number][] = [
    ["single paragraph", "Hello", 1],
    ["heading + paragraph", "# Title\n\nBody", 2],
    ["three paragraphs", "A\n\nB\n\nC", 3],
    ["bulleted list (one block per item)", "- A\n- B\n- C", 3],
    ["heading + list + paragraph", "# H\n\n- A\n- B\n\nEnd.", 4],
  ];

  for (const [name, md, expectedBlocks] of structureCases) {
    it(`${name} → ${expectedBlocks} blocks`, () => {
      const { value: v1 } = deserializeMarkdown(editor, md);
      const blockCount1 = Object.keys(v1).length;
      expect(blockCount1).toBe(expectedBlocks);

      const serialized = serializeMarkdown(editor, v1);
      const { value: v2 } = deserializeMarkdown(editor, serialized);
      const blockCount2 = Object.keys(v2).length;
      expect(blockCount2).toBe(blockCount1);
    });
  }
});

// =============================================================================
// 8. Edge cases
// =============================================================================

describe("edge cases", () => {
  it("empty string is idempotent", () => {
    const { first, second } = doubleRoundtrip(editor, "");
    expect(second).toBe(first);
  });

  it("whitespace only is idempotent", () => {
    const { first, second } = doubleRoundtrip(editor, "   \n\n   ");
    expect(second).toBe(first);
  });

  it("single newline between blocks normalizes to double", () => {
    const input = "# Heading\nParagraph";
    const output = roundtrip(editor, input);
    expect(output).toContain("# Heading");
    expect(output).toContain("Paragraph");
    // Stable after first pass
    const second = roundtrip(editor, output);
    expect(second).toBe(output);
  });

  it("triple+ newlines collapse to double", () => {
    const input = "# Heading\n\n\n\nParagraph";
    const output = roundtrip(editor, input);
    expect(output).not.toContain("\n\n\n");
    // Stable after first pass
    const second = roundtrip(editor, output);
    expect(second).toBe(output);
  });

  it("trailing newlines are trimmed", () => {
    const input = "# Heading\n\nContent\n\n\n";
    const output = roundtrip(editor, input);
    expect(output).not.toMatch(/\n$/);
  });

  it("special characters in content are preserved", () => {
    const md = "Text with <angle> brackets & ampersand.";
    const { first, second } = doubleRoundtrip(editor, md);
    expect(second).toBe(first);
  });

  it("very long paragraph is preserved", () => {
    const longText = "Word ".repeat(500).trim() + ".";
    const { first, second } = doubleRoundtrip(editor, longText);
    expect(second).toBe(first);
  });
});

import { describe, it, expect } from "vitest";
import {
  extractFrontmatter,
  prependFrontmatter,
  preprocessTocForDeserialize,
  preprocessMathForDeserialize,
  normalizeBlockSeparators,
} from "../markdown";

// =============================================================================
// extractFrontmatter
// =============================================================================

describe("extractFrontmatter", () => {
  it("extracts YAML frontmatter from markdown", () => {
    const md = `---
title: Hello
tags: [a, b]
---
# Content here`;
    const { frontmatter, body } = extractFrontmatter(md);
    expect(frontmatter).toBe("---\ntitle: Hello\ntags: [a, b]\n---\n");
    expect(body).toBe("# Content here");
  });

  it("returns empty frontmatter if none present", () => {
    const md = "# Just a heading\n\nSome text";
    const { frontmatter, body } = extractFrontmatter(md);
    expect(frontmatter).toBe("");
    expect(body).toBe(md);
  });

  it("handles frontmatter with empty body", () => {
    const md = "---\nkey: value\n---\n";
    const { frontmatter, body } = extractFrontmatter(md);
    expect(frontmatter).toBe("---\nkey: value\n---\n");
    expect(body).toBe("");
  });

  it("does not match --- in the middle of content", () => {
    const md = "Some text\n---\nMore text";
    const { frontmatter, body } = extractFrontmatter(md);
    expect(frontmatter).toBe("");
    expect(body).toBe(md);
  });
});

// =============================================================================
// prependFrontmatter
// =============================================================================

describe("prependFrontmatter", () => {
  it("prepends frontmatter to body", () => {
    const result = prependFrontmatter("---\nkey: val\n---\n", "# Hello");
    expect(result).toBe("---\nkey: val\n---\n# Hello");
  });

  it("returns body unchanged when no frontmatter", () => {
    const result = prependFrontmatter("", "# Hello");
    expect(result).toBe("# Hello");
  });

  it("adds newline if frontmatter doesn't end with one", () => {
    const result = prependFrontmatter("---\nkey: val\n---", "# Hello");
    expect(result).toBe("---\nkey: val\n---\n# Hello");
  });
});

// =============================================================================
// preprocessTocForDeserialize
// =============================================================================

describe("preprocessTocForDeserialize", () => {
  it("converts [TOC] to nav element", () => {
    const md = "[TOC]\n\n# Heading";
    const result = preprocessTocForDeserialize(md);
    expect(result).toContain('data-type="table-of-contents"');
    expect(result).not.toContain("[TOC]");
    expect(result).toContain("# Heading");
  });

  it("converts [TOC] on its own line only", () => {
    const md = "Some text with [TOC] inline";
    const result = preprocessTocForDeserialize(md);
    expect(result).toBe(md); // No replacement — [TOC] is not on its own line
  });

  it("handles [TOC] at start of document", () => {
    const md = "[TOC]";
    const result = preprocessTocForDeserialize(md);
    expect(result).toBe('<nav data-type="table-of-contents"></nav>');
  });

  it("handles [TOC] with trailing whitespace", () => {
    const md = "[TOC]   \n\n# Heading";
    const result = preprocessTocForDeserialize(md);
    expect(result).toContain('data-type="table-of-contents"');
  });

  it("leaves non-TOC content untouched", () => {
    const md = "# Heading\n\nJust a paragraph.";
    const result = preprocessTocForDeserialize(md);
    expect(result).toBe(md);
  });
});

// =============================================================================
// preprocessMathForDeserialize
// =============================================================================

describe("preprocessMathForDeserialize", () => {
  it("converts block math $$ fences to data-math-block divs", () => {
    const md = "Some text\n\n$$\nE = mc^2\n$$\n\nMore text";
    const result = preprocessMathForDeserialize(md);
    expect(result).toContain('data-math-block="true"');
    expect(result).toContain("E = mc^2");
    expect(result).not.toContain("$$");
  });

  it("converts inline math $..$ to data-math-inline spans", () => {
    const md = "The formula $E = mc^2$ is famous.";
    const result = preprocessMathForDeserialize(md);
    expect(result).toContain('data-math-inline="true"');
    expect(result).toContain("E = mc^2");
  });

  it("does not match $$ inside block math as inline", () => {
    const md = "$$\nx^2 + y^2 = z^2\n$$";
    const result = preprocessMathForDeserialize(md);
    // Should only have block math, no inline spans
    expect(result).toContain('data-math-block="true"');
    expect(result).not.toContain('data-math-inline');
  });

  it("handles LaTeX with special HTML chars", () => {
    const md = "Use $a < b$ and $c > d$ in math";
    const result = preprocessMathForDeserialize(md);
    expect(result).toContain("a &lt; b");
    expect(result).toContain("c &gt; d");
  });

  it("leaves non-math content untouched", () => {
    const md = "# Hello\n\nJust a paragraph with no math.";
    const result = preprocessMathForDeserialize(md);
    expect(result).toBe(md);
  });
});

// =============================================================================
// normalizeBlockSeparators
// =============================================================================

describe("normalizeBlockSeparators", () => {
  it("adds blank lines between blocks joined by single newline", () => {
    const md = "# Heading\nParagraph text\nAnother paragraph";
    const result = normalizeBlockSeparators(md);
    expect(result).toContain("# Heading\n\nParagraph text\n\nAnother paragraph");
  });

  it("preserves existing double newlines", () => {
    const md = "# Heading\n\nParagraph text\n\nAnother paragraph";
    const result = normalizeBlockSeparators(md);
    expect(result).toBe("# Heading\n\nParagraph text\n\nAnother paragraph");
  });

  it("does not add blank lines inside code fences", () => {
    const md = "```javascript\nconst x = 1;\nconst y = 2;\n```";
    const result = normalizeBlockSeparators(md);
    expect(result).toContain("const x = 1;\nconst y = 2;");
  });

  it("does not add blank lines inside math fences", () => {
    const md = "$$\nx^2 + y^2\n= z^2\n$$";
    const result = normalizeBlockSeparators(md);
    expect(result).toContain("x^2 + y^2\n= z^2");
  });

  it("does not add blank lines between list items", () => {
    const md = "- Item 1\n- Item 2\n- Item 3";
    const result = normalizeBlockSeparators(md);
    expect(result).toBe("- Item 1\n- Item 2\n- Item 3");
  });

  it("does not add blank lines between numbered list items", () => {
    const md = "1. First\n2. Second\n3. Third";
    const result = normalizeBlockSeparators(md);
    expect(result).toBe("1. First\n2. Second\n3. Third");
  });

  it("does not add blank lines between todo list items", () => {
    const md = "- [ ] Todo 1\n- [x] Todo 2\n- [ ] Todo 3";
    const result = normalizeBlockSeparators(md);
    expect(result).toBe("- [ ] Todo 1\n- [x] Todo 2\n- [ ] Todo 3");
  });

  it("collapses triple+ newlines to double", () => {
    const md = "# Heading\n\n\n\nParagraph";
    const result = normalizeBlockSeparators(md);
    expect(result).toBe("# Heading\n\nParagraph");
  });

  it("trims trailing whitespace", () => {
    const md = "# Heading\nParagraph\n\n";
    const result = normalizeBlockSeparators(md);
    expect(result).not.toMatch(/\n$/);
  });

  it("handles headings followed by content", () => {
    const md = "# H1\n## H2\n### H3\nParagraph";
    const result = normalizeBlockSeparators(md);
    expect(result).toBe("# H1\n\n## H2\n\n### H3\n\nParagraph");
  });

  it("handles divider followed by content", () => {
    const md = "---\nParagraph after divider";
    const result = normalizeBlockSeparators(md);
    expect(result).toBe("---\n\nParagraph after divider");
  });

  it("handles blockquotes", () => {
    const md = "> Quote text\nParagraph after";
    const result = normalizeBlockSeparators(md);
    expect(result).toBe("> Quote text\n\nParagraph after");
  });

  it("handles image blocks", () => {
    const md = "![alt](url)\nParagraph after image";
    const result = normalizeBlockSeparators(md);
    expect(result).toBe("![alt](url)\n\nParagraph after image");
  });

  it("handles mixed content", () => {
    const md = [
      "# Title",
      "Intro paragraph",
      "- Item 1",
      "- Item 2",
      "Another paragraph",
      "```js",
      "code()",
      "```",
      "Final paragraph",
    ].join("\n");

    const result = normalizeBlockSeparators(md);

    // Headings and paragraphs should be separated
    expect(result).toContain("# Title\n\nIntro paragraph");
    // List items should NOT be separated
    expect(result).toContain("- Item 1\n- Item 2");
    // List → paragraph should be separated
    expect(result).toContain("- Item 2\n\nAnother paragraph");
    // Code fence should be preserved
    expect(result).toContain("```js\ncode()\n```");
  });
});

// =============================================================================
// Frontmatter roundtrip
// =============================================================================

describe("frontmatter roundtrip", () => {
  it("extract then prepend is identity", () => {
    const original = "---\ntitle: Test\nslug: test-page\n---\n# Hello World\n\nSome content";
    const { frontmatter, body } = extractFrontmatter(original);
    const reconstructed = prependFrontmatter(frontmatter, body);
    expect(reconstructed).toBe(original);
  });
});

// =============================================================================
// Block separator roundtrip (normalize is idempotent)
// =============================================================================

describe("normalizeBlockSeparators idempotency", () => {
  const cases = [
    "# Heading\n\nParagraph\n\nAnother",
    "- Item 1\n- Item 2\n- Item 3",
    "```js\ncode()\n```",
    "$$\nE = mc^2\n$$",
    "> Quote\n\nParagraph",
    "---\n\nParagraph",
    "1. First\n2. Second",
    "- [ ] Todo\n- [x] Done",
  ];

  for (const input of cases) {
    it(`idempotent for: ${input.slice(0, 40)}...`, () => {
      const once = normalizeBlockSeparators(input);
      const twice = normalizeBlockSeparators(once);
      expect(twice).toBe(once);
    });
  }
});

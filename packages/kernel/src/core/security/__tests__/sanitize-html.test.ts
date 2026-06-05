import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "../sanitize-html.js";

describe("sanitizeHtml", () => {
  it("strips <script> tags and content", () => {
    const input = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert");
    expect(result).toContain("<p>Hello</p>");
    expect(result).toContain("<p>World</p>");
  });

  it("removes onerror attributes", () => {
    const input = '<img src="x" onerror="alert(1)">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("onerror");
  });

  it("removes onclick attributes", () => {
    const input = '<button onclick="alert(1)">Click</button>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("onclick");
  });

  it("removes onload attributes", () => {
    const input = '<body onload="alert(1)">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("onload");
  });

  it("removes javascript: URIs from href", () => {
    const input = '<a href="javascript:alert(1)">Click</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("javascript:");
  });

  it("removes javascript: URIs from src", () => {
    const input = '<img src="javascript:alert(1)">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("javascript:");
  });

  it("preserves safe HTML", () => {
    const input = '<h1>Title</h1><p>Text with <strong>bold</strong> and <em>italic</em></p><pre><code>code</code></pre>';
    const result = sanitizeHtml(input);
    expect(result).toContain("<h1>Title</h1>");
    expect(result).toContain("<strong>bold</strong>");
    expect(result).toContain("<em>italic</em>");
    expect(result).toContain("<pre><code>code</code></pre>");
  });

  it("preserves safe links", () => {
    const input = '<a href="https://example.com">Link</a>';
    const result = sanitizeHtml(input);
    expect(result).toContain('href="https://example.com"');
  });

  it("handles case-insensitive script tags", () => {
    const input = '<SCRIPT>alert(1)</SCRIPT>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("alert");
  });

  it("strips data: URIs from src", () => {
    const input = '<img src="data:text/html,<script>alert(1)</script>">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("data:");
  });
});

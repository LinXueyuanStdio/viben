import { describe, it, expect } from "vitest";
import {
  progressBar,
  formatTokens,
  truncateContent,
  splitMessage,
} from "../format-utils.js";

describe("progressBar", () => {
  it("renders progress bar at 0.5 ratio", () => {
    const bar = progressBar(0.5);
    expect(bar).toContain("▓");
    expect(bar).toContain("░");
    expect(bar.length).toBe(10);
  });
  it("renders full bar at ratio 1", () => {
    expect(progressBar(1)).toBe("▓▓▓▓▓▓▓▓▓▓");
  });
  it("renders empty bar at ratio 0", () => {
    expect(progressBar(0)).toBe("░░░░░░░░░░");
  });
  it("clamps ratio above 1", () => {
    expect(progressBar(1.5)).toBe("▓▓▓▓▓▓▓▓▓▓");
  });
});

describe("formatTokens", () => {
  it("formats thousands with k suffix (1 decimal)", () => {
    expect(formatTokens(12345)).toBe("12.3k");
    expect(formatTokens(12500)).toBe("12.5k");
    expect(formatTokens(28000)).toBe("28k");
  });
  it("formats millions with M suffix", () => {
    expect(formatTokens(1000000)).toBe("1M");
    expect(formatTokens(1500000)).toBe("1.5M");
  });
  it("formats small numbers without suffix", () => {
    expect(formatTokens(500)).toBe("500");
  });
});

describe("truncateContent", () => {
  it("returns text unchanged if under limit", () => {
    expect(truncateContent("short", 100)).toBe("short");
  });
  it("truncates with newline before indicator", () => {
    const long = "a".repeat(200);
    const result = truncateContent(long, 50);
    expect(result).toContain("\n… (truncated)");
    expect(result.startsWith("a".repeat(50))).toBe(true);
  });
});

describe("splitMessage", () => {
  it("returns single chunk for short text", () => {
    expect(splitMessage("hello", 100)).toEqual(["hello"]);
  });
  it("splits at paragraph boundary", () => {
    const text = "a".repeat(15) + "\n\n" + "b".repeat(15);
    const chunks = splitMessage(text, 20);
    expect(chunks.length).toBe(2);
  });
  it("does not split inside code blocks", () => {
    const before = "a".repeat(100);
    const code = "```\n" + "code line\n".repeat(20) + "```";
    const after = "b".repeat(50);
    const text = before + "\n\n" + code + "\n\n" + after;
    const chunks = splitMessage(text, 200);
    for (const chunk of chunks) {
      const backtickCount = (chunk.match(/```/g) ?? []).length;
      expect(backtickCount % 2).toBe(0);
    }
  });
  it("handles balanced splitting for slightly-over text", () => {
    const text = "a".repeat(50) + "\n\n" + "b".repeat(50);
    const chunks = splitMessage(text, 80);
    // Should split roughly in half, not 80+20
    expect(chunks.length).toBe(2);
  });
});

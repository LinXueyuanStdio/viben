import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("overlay background CSS", () => {
  test("uses a low-contrast oklch stage background without radial decorations", () => {
    const css = readFileSync(resolve(__dirname, "index.css"), "utf8");

    expect(css).toContain(".overlay-stage-background");
    expect(css).toContain("background-color: var(--background)");
    expect(css).toContain("background-image:");
    expect(css).toContain("color-mix(in oklch");
    expect(css).not.toContain(".overlay-stage-background {\n  background:");
    expect(css).not.toContain("hsl(var(--background");
    expect(css).not.toContain("hsl(var(--foreground");
    expect(css).not.toContain("hsl(var(--border");
    expect(css).not.toContain("hsl(var(--primary");
    expect(css).not.toContain("radial-gradient");
  });
});

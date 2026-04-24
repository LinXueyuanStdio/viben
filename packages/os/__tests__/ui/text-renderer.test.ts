import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("troika-three-text", () => {
  return {
    Text: vi.fn().mockImplementation(() => {
      return {
        text: "",
        fontSize: 16,
        color: 0xffffff,
        font: null as string | null,
        anchorX: "left",
        anchorY: "top",
        maxWidth: Infinity,
        textAlign: "left",
        lineHeight: 1.2,
        position: { x: 0, y: 0, z: 0, set: vi.fn() },
        sync: vi.fn((cb?: () => void) => cb?.()),
        dispose: vi.fn(),
        removeFromParent: vi.fn(),
      };
    }),
  };
});

import { TextRenderer } from "../../src/ui/text";

describe("TextRenderer", () => {
  let tr: TextRenderer;

  beforeEach(() => {
    tr = new TextRenderer();
  });

  it("creates a text mesh with default properties", () => {
    const mesh = tr.createText({ text: "Hello" });
    expect(mesh.text).toBe("Hello");
    expect(mesh.fontSize).toBe(17);
  });

  it("applies custom fontSize and color", () => {
    const mesh = tr.createText({ text: "X", fontSize: 24, color: "#FF0000" });
    expect(mesh.fontSize).toBe(24);
    expect(mesh.color).toBe("#FF0000");
  });

  it("disposes a text mesh", () => {
    const mesh = tr.createText({ text: "test" });
    tr.disposeText(mesh);
    expect(mesh.dispose).toHaveBeenCalled();
    expect(mesh.removeFromParent).toHaveBeenCalled();
  });

  it("disposes all text meshes", () => {
    const m1 = tr.createText({ text: "a" });
    const m2 = tr.createText({ text: "b" });
    tr.dispose();
    expect(m1.dispose).toHaveBeenCalled();
    expect(m2.dispose).toHaveBeenCalled();
  });
});

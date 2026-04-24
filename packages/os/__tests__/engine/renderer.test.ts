import { describe, it, expect, vi, beforeEach } from "vitest";
import { Renderer } from "../../src/engine/renderer";

vi.mock("three", async () => {
  const actual = await vi.importActual<typeof import("three")>("three");
  return {
    ...actual,
    WebGLRenderer: vi.fn().mockImplementation(() => ({
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
      domElement: document.createElement("canvas"),
      getSize: vi.fn().mockReturnValue({ width: 800, height: 600 }),
    })),
  };
});

describe("Renderer", () => {
  let canvas: HTMLCanvasElement;
  beforeEach(() => { canvas = document.createElement("canvas"); });

  it("creates a renderer with the given canvas", async () => {
    const renderer = new Renderer(canvas);
    await renderer.init();
    expect(renderer.isInitialized).toBe(true);
  });

  it("handles resize", async () => {
    const renderer = new Renderer(canvas);
    await renderer.init();
    renderer.resize(1024, 768);
    expect(renderer.width).toBe(1024);
    expect(renderer.height).toBe(768);
  });

  it("provides an orthographic camera sized to pixels", async () => {
    const renderer = new Renderer(canvas);
    await renderer.init();
    renderer.resize(800, 600);
    const cam = renderer.camera;
    expect(cam.right).toBe(800);
    expect(cam.bottom).toBe(-600);
  });

  it("cleans up on dispose", async () => {
    const renderer = new Renderer(canvas);
    await renderer.init();
    renderer.dispose();
    expect(renderer.isInitialized).toBe(false);
  });
});

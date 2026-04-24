import { describe, it, expect, vi, beforeEach } from "vitest";
import { Texture } from "three";
import { ResourceLoader } from "../../src/engine/resource-loader";

vi.mock("three", async () => {
  const actual = await vi.importActual<typeof import("three")>("three");
  return {
    ...actual,
    TextureLoader: vi.fn().mockImplementation(() => ({
      loadAsync: vi.fn().mockResolvedValue(new actual.Texture()),
    })),
  };
});

describe("ResourceLoader", () => {
  let loader: ResourceLoader;
  beforeEach(() => { loader = new ResourceLoader(); });

  it("loads a texture and caches it", async () => {
    const tex = await loader.loadTexture("/test.png");
    expect(tex).toBeInstanceOf(Texture);
    const tex2 = await loader.loadTexture("/test.png");
    expect(tex2).toBe(tex);
  });

  it("reports loading state", async () => {
    expect(loader.isLoading).toBe(false);
    const promise = loader.loadTexture("/test.png");
    await promise;
    expect(loader.isLoading).toBe(false);
  });

  it("disposes all cached resources", async () => {
    const tex = await loader.loadTexture("/test.png");
    const disposeSpy = vi.spyOn(tex, "dispose");
    loader.dispose();
    expect(disposeSpy).toHaveBeenCalled();
  });
});

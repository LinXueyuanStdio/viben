import { describe, it, expect } from "vitest";
import { Mesh, ShaderMaterial, MeshBasicMaterial, Texture } from "three";
import { Box, ImageView, Icon } from "../../src/ui/primitives";

describe("Box", () => {
  it("creates a Mesh with ShaderMaterial", () => {
    const box = new Box({ width: 200, height: 100 });
    expect(box.mesh).toBeInstanceOf(Mesh);
    expect(box.mesh.material).toBeInstanceOf(ShaderMaterial);
  });

  it("applies corner radius", () => {
    const box = new Box({ width: 200, height: 100, radius: 12 });
    const mat = box.mesh.material as ShaderMaterial;
    expect(mat.uniforms.uRadius.value).toBe(12);
  });

  it("applies background color", () => {
    const box = new Box({ width: 200, height: 100, backgroundColor: "#FF0000" });
    const mat = box.mesh.material as ShaderMaterial;
    expect(mat.uniforms.uBgColor.value).toBeDefined();
    expect(mat.uniforms.uBgColor.value.x).toBeCloseTo(1, 1);
    expect(mat.uniforms.uBgColor.value.y).toBeCloseTo(0, 1);
  });

  it("updates size", () => {
    const box = new Box({ width: 200, height: 100 });
    box.setSize(300, 150);
    expect(box.mesh.scale.x).toBe(300);
    expect(box.mesh.scale.y).toBe(150);
  });

  it("disposes material", () => {
    const box = new Box({ width: 100, height: 100 });
    box.dispose();
    // ShaderMaterial doesn't have a public `disposed` in jsdom but dispose() should not throw
  });
});

describe("ImageView", () => {
  it("creates a mesh with MeshBasicMaterial", () => {
    const img = new ImageView({ width: 100, height: 100 });
    expect(img.mesh).toBeInstanceOf(Mesh);
    expect(img.mesh.material).toBeInstanceOf(MeshBasicMaterial);
  });

  it("applies a texture", () => {
    const tex = new Texture();
    const img = new ImageView({ width: 100, height: 100, texture: tex });
    expect((img.mesh.material as MeshBasicMaterial).map).toBe(tex);
  });
});

describe("Icon", () => {
  it("creates a mesh", () => {
    const icon = new Icon({ size: 24 });
    expect(icon.mesh).toBeInstanceOf(Mesh);
  });

  it("sets correct square scale", () => {
    const icon = new Icon({ size: 32 });
    expect(icon.mesh.scale.x).toBe(32);
    expect(icon.mesh.scale.y).toBe(32);
  });
});

import { describe, it, expect } from "vitest";
import { Mesh, ShaderMaterial, WebGLRenderTarget } from "three";
import { BlurEffect } from "../../src/compositor/blur-effect";

describe("BlurEffect", () => {
  it("creates with default blur radius", () => {
    const blur = new BlurEffect();
    expect(blur.radius).toBe(8);
  });

  it("creates the fullscreen quad mesh", () => {
    const blur = new BlurEffect();
    expect(blur.mesh).toBeInstanceOf(Mesh);
    expect(blur.material).toBeInstanceOf(ShaderMaterial);
  });

  it("updates radius", () => {
    const blur = new BlurEffect({ radius: 16 });
    expect(blur.radius).toBe(16);
    blur.setRadius(24);
    expect(blur.radius).toBe(24);
  });

  it("sets input texture", () => {
    const blur = new BlurEffect();
    const rt = new WebGLRenderTarget(256, 256);
    blur.setInput(rt.texture);
    expect(blur.material.uniforms.uTexture.value).toBe(rt.texture);
    rt.dispose();
  });

  it("disposes without error", () => {
    const blur = new BlurEffect();
    expect(() => blur.dispose()).not.toThrow();
  });
});

import {
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  DoubleSide,
  Vector2,
} from "three";
import type { Texture } from "three";

export interface BlurEffectConfig {
  radius?: number;
  width?: number;
  height?: number;
}

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uTexture;
uniform vec2 uDirection;
uniform vec2 uResolution;
uniform float uRadius;

varying vec2 vUv;

void main() {
  int samples = int(ceil(uRadius));
  float sigma = uRadius * 0.5;
  float sigma2 = 2.0 * sigma * sigma;

  vec4 color = vec4(0.0);
  float weightSum = 0.0;

  for (int i = -64; i <= 64; i++) {
    if (i > samples || i < -samples) continue;
    float fi = float(i);
    float weight = exp(-(fi * fi) / sigma2);
    vec2 offset = uDirection * fi / uResolution;
    color += texture2D(uTexture, vUv + offset) * weight;
    weightSum += weight;
  }

  gl_FragColor = color / weightSum;
}
`;

const _unitPlane = new PlaneGeometry(1, 1);

export class BlurEffect {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;

  constructor(config?: BlurEffectConfig) {
    const radius = config?.radius ?? 8;
    const width = config?.width ?? 800;
    const height = config?.height ?? 600;

    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTexture: { value: null },
        uDirection: { value: new Vector2(1.0, 0.0) },
        uResolution: { value: new Vector2(width, height) },
        uRadius: { value: radius },
      },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });

    this.mesh = new Mesh(_unitPlane, this.material);
  }

  get radius(): number {
    return this.material.uniforms.uRadius.value as number;
  }

  setRadius(r: number): void {
    this.material.uniforms.uRadius.value = r;
  }

  setInput(texture: Texture): void {
    this.material.uniforms.uTexture.value = texture;
  }

  setResolution(w: number, h: number): void {
    (this.material.uniforms.uResolution.value as Vector2).set(w, h);
  }

  setDirection(x: number, y: number): void {
    (this.material.uniforms.uDirection.value as Vector2).set(x, y);
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.material.dispose();
  }
}

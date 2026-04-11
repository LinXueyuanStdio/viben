import { Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector4, DoubleSide } from "three";
import { roundedRectVertexShader, roundedRectFragmentShader } from "./rounded-rect-shader";

export interface BoxConfig {
  width: number;
  height: number;
  radius?: number;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
}

function hexToVec4(hex: string, alpha = 1): Vector4 {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  return new Vector4(r, g, b, alpha);
}

const _unitPlane = new PlaneGeometry(1, 1);

export class Box {
  readonly mesh: Mesh;
  private _material: ShaderMaterial;

  constructor(config: BoxConfig) {
    this._material = new ShaderMaterial({
      vertexShader: roundedRectVertexShader,
      fragmentShader: roundedRectFragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        uSize: { value: new Vector2(config.width, config.height) },
        uRadius: { value: config.radius ?? 0 },
        uBgColor: { value: config.backgroundColor ? hexToVec4(config.backgroundColor) : new Vector4(1, 1, 1, 1) },
        uBorderColor: { value: config.borderColor ? hexToVec4(config.borderColor) : new Vector4(0, 0, 0, 0) },
        uBorderWidth: { value: config.borderWidth ?? 0 },
      },
    });
    this.mesh = new Mesh(_unitPlane, this._material);
    this.mesh.scale.set(config.width, config.height, 1);
  }

  setSize(width: number, height: number): void {
    this.mesh.scale.set(width, height, 1);
    this._material.uniforms.uSize.value.set(width, height);
  }

  setBackgroundColor(hex: string, alpha = 1): void {
    this._material.uniforms.uBgColor.value = hexToVec4(hex, alpha);
  }

  setBorderColor(hex: string, alpha = 1): void {
    this._material.uniforms.uBorderColor.value = hexToVec4(hex, alpha);
  }

  setBorderWidth(w: number): void {
    this._material.uniforms.uBorderWidth.value = w;
  }

  setRadius(r: number): void {
    this._material.uniforms.uRadius.value = r;
  }

  dispose(): void {
    this._material.dispose();
  }
}

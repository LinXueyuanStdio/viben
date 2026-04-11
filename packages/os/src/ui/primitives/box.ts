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

function parseColorInto(out: Vector4, color: string, alpha = 1): void {
  const rgbaMatch = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/);
  if (rgbaMatch) {
    out.set(
      parseInt(rgbaMatch[1], 10) / 255,
      parseInt(rgbaMatch[2], 10) / 255,
      parseInt(rgbaMatch[3], 10) / 255,
      rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : alpha,
    );
    return;
  }
  const c = color.replace("#", "");
  out.set(
    parseInt(c.substring(0, 2), 16) / 255,
    parseInt(c.substring(2, 4), 16) / 255,
    parseInt(c.substring(4, 6), 16) / 255,
    alpha,
  );
}

const _unitPlane = new PlaneGeometry(1, 1);

export class Box {
  readonly mesh: Mesh;
  private _material: ShaderMaterial;

  constructor(config: BoxConfig) {
    const bgColor = new Vector4(1, 1, 1, 1);
    if (config.backgroundColor) parseColorInto(bgColor, config.backgroundColor);
    const borderColor = new Vector4(0, 0, 0, 0);
    if (config.borderColor) parseColorInto(borderColor, config.borderColor);
    this._material = new ShaderMaterial({
      vertexShader: roundedRectVertexShader,
      fragmentShader: roundedRectFragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        uSize: { value: new Vector2(config.width, config.height) },
        uRadius: { value: config.radius ?? 0 },
        uBgColor: { value: bgColor },
        uBorderColor: { value: borderColor },
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

  setBackgroundColor(color: string, alpha = 1): void {
    parseColorInto(this._material.uniforms.uBgColor.value as Vector4, color, alpha);
  }

  setBorderColor(color: string, alpha = 1): void {
    parseColorInto(this._material.uniforms.uBorderColor.value as Vector4, color, alpha);
  }

  setBorderWidth(w: number): void {
    this._material.uniforms.uBorderWidth.value = w;
  }

  setRadius(r: number): void {
    this._material.uniforms.uRadius.value = r;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this._material.dispose();
  }
}

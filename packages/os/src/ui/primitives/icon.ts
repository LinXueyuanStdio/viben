import { Mesh, PlaneGeometry, MeshBasicMaterial, Texture, DoubleSide } from "three";

export interface IconConfig {
  size: number;
  texture?: Texture;
  color?: number;
}

const _unitPlane = new PlaneGeometry(1, 1);

export class Icon {
  readonly mesh: Mesh;
  private _material: MeshBasicMaterial;

  constructor(config: IconConfig) {
    this._material = new MeshBasicMaterial({
      map: config.texture ?? null,
      color: config.color ?? 0xffffff,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    this.mesh = new Mesh(_unitPlane, this._material);
    this.mesh.scale.set(config.size, config.size, 1);
  }

  setTexture(tex: Texture): void {
    this._material.map = tex;
    this._material.needsUpdate = true;
  }

  setSize(size: number): void {
    this.mesh.scale.set(size, size, 1);
  }

  setColor(c: number): void {
    this._material.color.set(c);
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this._material.dispose();
  }
}

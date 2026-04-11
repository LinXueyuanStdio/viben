import { Mesh, PlaneGeometry, MeshBasicMaterial, Texture, DoubleSide } from "three";

export interface ImageViewConfig {
  width: number;
  height: number;
  texture?: Texture;
}

const _unitPlane = new PlaneGeometry(1, 1);

export class ImageView {
  readonly mesh: Mesh;
  private _material: MeshBasicMaterial;

  constructor(config: ImageViewConfig) {
    this._material = new MeshBasicMaterial({
      map: config.texture ?? null,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    this.mesh = new Mesh(_unitPlane, this._material);
    this.mesh.scale.set(config.width, config.height, 1);
  }

  setTexture(tex: Texture): void {
    this._material.map = tex;
    this._material.needsUpdate = true;
  }

  setSize(width: number, height: number): void {
    this.mesh.scale.set(width, height, 1);
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this._material.dispose();
  }
}

import { WebGLRenderTarget } from "three";

export class RTTPool {
  private _targets = new Map<string, WebGLRenderTarget>();

  acquire(id: string, width: number, height: number): WebGLRenderTarget {
    let rt = this._targets.get(id);
    if (rt) {
      if (rt.width !== width || rt.height !== height) rt.setSize(width, height);
      return rt;
    }
    rt = new WebGLRenderTarget(width, height, { depthBuffer: true, stencilBuffer: true });
    this._targets.set(id, rt);
    return rt;
  }

  has(id: string): boolean { return this._targets.has(id); }

  release(id: string): void {
    const rt = this._targets.get(id);
    if (rt) { rt.dispose(); this._targets.delete(id); }
  }

  dispose(): void {
    for (const rt of this._targets.values()) rt.dispose();
    this._targets.clear();
  }
}

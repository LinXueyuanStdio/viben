import { TextureLoader, Texture } from "three";

export class ResourceLoader {
  private _textureLoader = new TextureLoader();
  private _textureCache = new Map<string, Texture>();
  private _pendingCount = 0;

  get isLoading(): boolean { return this._pendingCount > 0; }

  async loadTexture(url: string): Promise<Texture> {
    const cached = this._textureCache.get(url);
    if (cached) return cached;
    this._pendingCount++;
    try {
      const texture = await this._textureLoader.loadAsync(url);
      this._textureCache.set(url, texture);
      return texture;
    } finally {
      this._pendingCount--;
    }
  }

  getTexture(url: string): Texture | undefined { return this._textureCache.get(url); }

  dispose(): void {
    for (const tex of this._textureCache.values()) tex.dispose();
    this._textureCache.clear();
  }
}

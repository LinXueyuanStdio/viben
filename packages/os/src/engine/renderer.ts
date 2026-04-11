import {
  WebGLRenderer,
  OrthographicCamera,
  Scene,
} from "three";
import type { WebGPURenderer as WebGPURendererType } from "three/webgpu";

const MAX_PIXEL_RATIO = 2;

export class Renderer {
  private _renderer: WebGLRenderer | WebGPURendererType | null = null;
  private _camera: OrthographicCamera;
  private _scene: Scene;
  private _canvas: HTMLCanvasElement;
  private _width = 0;
  private _height = 0;
  private _initialized = false;
  private _useWebGPU = false;

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
    this._camera = new OrthographicCamera(0, 1, 0, -1, 0.1, 1000);
    this._camera.position.z = 100;
    this._scene = new Scene();
  }

  get isInitialized(): boolean { return this._initialized; }
  get width(): number { return this._width; }
  get height(): number { return this._height; }
  get camera(): OrthographicCamera { return this._camera; }
  get scene(): Scene { return this._scene; }
  get isWebGPU(): boolean { return this._useWebGPU; }

  get threeRenderer(): WebGLRenderer | WebGPURendererType {
    if (!this._renderer) throw new Error("Renderer not initialized");
    return this._renderer;
  }

  async init(): Promise<void> {
    if (this._initialized) return;
    if (typeof navigator !== "undefined" && "gpu" in navigator) {
      try {
        const { WebGPURenderer } = await import("three/webgpu");
        const gpuRenderer = new WebGPURenderer({ canvas: this._canvas, antialias: true });
        await gpuRenderer.init();
        gpuRenderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
        this._renderer = gpuRenderer;
        this._useWebGPU = true;
        this._initialized = true;
        return;
      } catch { /* fall through to WebGL */ }
    }
    const glRenderer = new WebGLRenderer({ canvas: this._canvas, antialias: true });
    glRenderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, MAX_PIXEL_RATIO));
    this._renderer = glRenderer;
    this._initialized = true;
  }

  resize(width: number, height: number): void {
    this._width = width;
    this._height = height;
    this._renderer?.setSize(width, height);
    this._camera.left = 0;
    this._camera.right = width;
    this._camera.top = 0;
    this._camera.bottom = -height;
    this._camera.updateProjectionMatrix();
  }

  render(scene?: Scene, camera?: OrthographicCamera): void {
    if (!this._renderer) return;
    this._renderer.render(scene ?? this._scene, camera ?? this._camera);
  }

  dispose(): void {
    this._renderer?.dispose();
    this._renderer = null;
    this._initialized = false;
  }
}

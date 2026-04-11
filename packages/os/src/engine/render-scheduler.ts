export class RenderScheduler {
  private _dirty = false;
  private _animatingCount = 0;
  private _rafId: number | null = null;
  private _renderFn: (dt: number) => void;
  private _lastTime = 0;
  private _disposed = false;

  constructor(renderFn: (dt: number) => void) {
    this._renderFn = renderFn;
  }

  get isAnimating(): boolean { return this._animatingCount > 0; }

  markDirty(): void {
    if (this._disposed) return;
    if (this._dirty || this._animatingCount > 0) return;
    this._dirty = true;
    this._scheduleFrame();
  }

  startAnimation(): void {
    this._animatingCount++;
    if (this._animatingCount === 1) this._scheduleFrame();
  }

  stopAnimation(): void {
    this._animatingCount = Math.max(0, this._animatingCount - 1);
  }

  dispose(): void {
    this._disposed = true;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  private _scheduleFrame(): void {
    if (this._rafId !== null) return;
    this._rafId = requestAnimationFrame((time) => this._frame(time));
  }

  private _frame(time: number): void {
    this._rafId = null;
    if (this._disposed) return;
    const dt = this._lastTime === 0 ? 16 : time - this._lastTime;
    this._lastTime = time;
    this._dirty = false;
    this._renderFn(dt);
    if (this._animatingCount > 0) this._scheduleFrame();
  }
}

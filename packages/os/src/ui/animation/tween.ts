export type EasingFn = (t: number) => number;

export const Easing = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) =>
    t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeOutCubic: (t: number) => --t * t * t + 1,
} as const;

export interface TweenConfig {
  from: number;
  to: number;
  duration: number;
  easing?: EasingFn;
}

export class Tween {
  private _from: number;
  private _to: number;
  private _duration: number;
  private _easing: EasingFn;
  private _elapsed = 0;
  private _value: number;
  private _done = false;

  constructor(config: TweenConfig) {
    this._from = config.from;
    this._to = config.to;
    this._duration = config.duration;
    this._easing = config.easing ?? Easing.easeOutQuad;
    this._value = config.from;
  }

  get value(): number {
    return this._value;
  }
  get done(): boolean {
    return this._done;
  }

  update(dt: number): number {
    if (this._done) return this._value;

    this._elapsed += dt;
    const progress = Math.min(this._elapsed / this._duration, 1);
    this._value = this._from + (this._to - this._from) * this._easing(progress);

    if (progress >= 1) {
      this._value = this._to;
      this._done = true;
    }

    return this._value;
  }

  reset(from: number, to: number): void {
    this._from = from;
    this._to = to;
    this._elapsed = 0;
    this._value = from;
    this._done = false;
  }
}

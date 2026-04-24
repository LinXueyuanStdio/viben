export interface SpringConfig {
  from: number;
  to: number;
  stiffness?: number; // default 170 (iOS-like)
  damping?: number; // default 26
  mass?: number; // default 1
  restThreshold?: number; // default 0.01
}

export class Spring {
  private _value: number;
  private _velocity = 0;
  private _target: number;
  private _stiffness: number;
  private _damping: number;
  private _mass: number;
  private _restThreshold: number;
  private _done = false;

  constructor(config: SpringConfig) {
    this._value = config.from;
    this._target = config.to;
    this._stiffness = config.stiffness ?? 170;
    this._damping = config.damping ?? 26;
    this._mass = config.mass ?? 1;
    this._restThreshold = config.restThreshold ?? 0.01;
  }

  get value(): number {
    return this._value;
  }
  get done(): boolean {
    return this._done;
  }
  get velocity(): number {
    return this._velocity;
  }

  setTarget(target: number): void {
    this._target = target;
    this._done = false;
  }

  update(dt: number): number {
    if (this._done) return this._value;

    const displacement = this._value - this._target;
    const springForce = -this._stiffness * displacement;
    const dampingForce = -this._damping * this._velocity;
    const acceleration = (springForce + dampingForce) / this._mass;

    this._velocity += acceleration * dt;
    this._value += this._velocity * dt;

    if (
      Math.abs(this._velocity) < this._restThreshold &&
      Math.abs(this._value - this._target) < this._restThreshold
    ) {
      this._value = this._target;
      this._velocity = 0;
      this._done = true;
    }

    return this._value;
  }

  reset(from: number, to: number): void {
    this._value = from;
    this._target = to;
    this._velocity = 0;
    this._done = false;
  }
}

import { BaseComponent } from "./base-component";
import { Box } from "../primitives/box";
import { darkTheme } from "../theme";
import type { Theme } from "../theme";

export interface SliderConfig {
  min?: number;
  max?: number;
  value?: number;
  width?: number;
  height?: number;
  onChange?: (value: number) => void;
  theme?: Theme;
}

export class Slider extends BaseComponent {
  private _track: Box;
  private _fill: Box;
  private _thumb: Box;
  private _min: number;
  private _max: number;
  private _value: number;
  private _width: number;
  private _height: number;
  private _thumbSize: number;
  private _onChange?: (value: number) => void;

  constructor(config: SliderConfig = {}) {
    super();
    const theme = config.theme ?? darkTheme;
    this._min = config.min ?? 0;
    this._max = config.max ?? 1;
    this._value = config.value ?? this._min;
    this._width = config.width ?? 200;
    this._height = config.height ?? 4;
    this._thumbSize = 20;
    this._onChange = config.onChange;

    this._track = new Box({
      width: this._width, height: this._height,
      radius: this._height / 2, backgroundColor: theme.colors.surfaceHover,
    });
    const progress = this._normalizedValue();
    this._fill = new Box({
      width: Math.max(1, this._width * progress), height: this._height,
      radius: this._height / 2, backgroundColor: theme.colors.primary,
    });
    this._thumb = new Box({
      width: this._thumbSize, height: this._thumbSize,
      radius: this._thumbSize / 2, backgroundColor: "#FFFFFF",
    });

    this._updatePositions();
    this.root.add(this._track.mesh);
    this.root.add(this._fill.mesh);
    this.root.add(this._thumb.mesh);
    this.root.userData.interactive = true;
  }

  get value(): number { return this._value; }

  setValue(v: number): void {
    this._value = Math.max(this._min, Math.min(this._max, v));
    this._updatePositions();
    this._onChange?.(this._value);
  }

  setNormalized(n: number): void {
    this.setValue(this._min + (this._max - this._min) * Math.max(0, Math.min(1, n)));
  }

  private _normalizedValue(): number {
    return (this._value - this._min) / (this._max - this._min);
  }

  private _updatePositions(): void {
    const n = this._normalizedValue();
    const fillW = Math.max(1, this._width * n);
    this._fill.setSize(fillW, this._height);
    this._fill.mesh.position.x = (fillW - this._width) / 2;
    this._fill.mesh.position.z = 0.05;
    this._thumb.mesh.position.x = n * this._width - this._width / 2;
    this._thumb.mesh.position.z = 0.1;
  }

  dispose(): void {
    this._track.dispose();
    this._fill.dispose();
    this._thumb.dispose();
    this._disposed = true;
  }
}

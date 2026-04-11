import { BaseComponent } from "./base-component";
import { Box } from "../primitives/box";
import { Spring } from "../animation/spring";
import { darkTheme } from "../theme";
import type { Theme } from "../theme";

export interface ToggleConfig {
  value?: boolean;
  width?: number;
  height?: number;
  onChange?: (value: boolean) => void;
  theme?: Theme;
}

export class Toggle extends BaseComponent {
  private _track: Box;
  private _thumb: Box;
  private _value: boolean;
  private _spring: Spring;
  private _onChange?: (value: boolean) => void;
  private _width: number;
  private _height: number;
  private _thumbSize: number;

  constructor(config: ToggleConfig = {}) {
    super();
    const theme = config.theme ?? darkTheme;
    this._value = config.value ?? false;
    this._onChange = config.onChange;
    this._width = config.width ?? 51;
    this._height = config.height ?? 31;
    this._thumbSize = this._height - 4;

    this._track = new Box({
      width: this._width, height: this._height,
      radius: this._height / 2,
      backgroundColor: this._value ? theme.colors.success : theme.colors.surfaceHover,
    });

    this._thumb = new Box({
      width: this._thumbSize, height: this._thumbSize,
      radius: this._thumbSize / 2, backgroundColor: "#FFFFFF",
    });

    const thumbX = this._value ? this._width - this._thumbSize - 2 : 2;
    this._thumb.mesh.position.set(thumbX - this._width / 2 + this._thumbSize / 2, 0, 0.1);
    this._spring = new Spring({ from: thumbX, to: thumbX });

    this.root.add(this._track.mesh);
    this.root.add(this._thumb.mesh);
    this.root.userData.interactive = true;
  }

  get value(): boolean { return this._value; }

  toggle(): void {
    this._value = !this._value;
    const targetX = this._value ? this._width - this._thumbSize - 2 : 2;
    this._spring.setTarget(targetX);
    this._onChange?.(this._value);
  }

  handleTap(): void { this.toggle(); }

  update(dt: number): void {
    if (this._disposed || this._spring.done) return;
    this._spring.update(dt);
    const x = this._spring.value;
    this._thumb.mesh.position.x = x - this._width / 2 + this._thumbSize / 2;
  }

  dispose(): void {
    this._track.dispose();
    this._thumb.dispose();
    this._disposed = true;
  }
}

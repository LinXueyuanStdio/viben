import { BaseComponent } from "./base-component";
import { Box } from "../primitives/box";
import { darkTheme } from "../theme";
import type { Theme } from "../theme";

export interface TextInputConfig {
  width: number;
  height?: number;
  placeholder?: string;
  value?: string;
  onTextChange?: (text: string) => void;
  theme?: Theme;
}

export class TextInput extends BaseComponent {
  private _box: Box;
  private _value: string;
  private _placeholder: string;
  private _focused = false;
  private _onTextChange?: (text: string) => void;
  private _theme: Theme;

  constructor(config: TextInputConfig) {
    super();
    this._theme = config.theme ?? darkTheme;
    this._value = config.value ?? "";
    this._placeholder = config.placeholder ?? "";
    this._onTextChange = config.onTextChange;
    this._box = new Box({
      width: config.width, height: config.height ?? 44,
      radius: this._theme.radii.md,
      backgroundColor: this._theme.colors.surface,
      borderColor: this._theme.colors.border, borderWidth: 1,
    });
    this.root.add(this._box.mesh);
    this.root.userData.interactive = true;
  }

  get value(): string { return this._value; }
  get focused(): boolean { return this._focused; }

  focus(): void { this._focused = true; this._box.setBorderColor(this._theme.colors.primary); }
  blur(): void { this._focused = false; this._box.setBorderColor(this._theme.colors.border); }

  insertText(text: string): void {
    this._value += text;
    this._onTextChange?.(this._value);
  }

  deleteBackward(): void {
    if (this._value.length > 0) {
      this._value = this._value.slice(0, -1);
      this._onTextChange?.(this._value);
    }
  }

  setValue(text: string): void {
    this._value = text;
    this._onTextChange?.(this._value);
  }

  dispose(): void { this._box.dispose(); this._disposed = true; }
}

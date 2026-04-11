import { BaseComponent } from "./base-component";
import { Box } from "../primitives/box";
import { darkTheme } from "../theme";
import type { Theme } from "../theme";

export interface ButtonConfig {
  label: string;
  width: number;
  height: number;
  radius?: number;
  backgroundColor?: string;
  textColor?: string;
  onTap?: () => void;
  theme?: Theme;
}

export class Button extends BaseComponent {
  private _box: Box;
  private _label: string;
  private _onTap?: () => void;

  constructor(config: ButtonConfig) {
    super();
    const theme = config.theme ?? darkTheme;
    this._label = config.label;
    this._onTap = config.onTap;
    this._box = new Box({
      width: config.width,
      height: config.height,
      radius: config.radius ?? theme.radii.md,
      backgroundColor: config.backgroundColor ?? theme.colors.primary,
    });
    this.root.add(this._box.mesh);
    this.root.userData.interactive = true;
  }

  get label(): string { return this._label; }

  setLabel(text: string): void { this._label = text; }

  handleTap(): void { this._onTap?.(); }

  dispose(): void {
    this._box.dispose();
    this._disposed = true;
  }
}

import { BaseComponent } from "./base-component";
import { Box } from "../primitives/box";
import { darkTheme } from "../theme";
import type { Theme } from "../theme";

export interface NavigationBarConfig {
  width: number;
  height?: number;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  theme?: Theme;
}

export class NavigationBar extends BaseComponent {
  private _box: Box;
  private _title: string;
  private _onBack?: () => void;

  constructor(config: NavigationBarConfig) {
    super();
    const theme = config.theme ?? darkTheme;
    this._title = config.title ?? "";
    this._onBack = config.onBack;
    this._box = new Box({ width: config.width, height: config.height ?? 44, backgroundColor: theme.colors.surface });
    this.root.add(this._box.mesh);
    this.root.userData.interactive = true;
  }

  get title(): string { return this._title; }
  setTitle(title: string): void { this._title = title; }
  handleBack(): void { this._onBack?.(); }
  dispose(): void { this._box.dispose(); this._disposed = true; }
}

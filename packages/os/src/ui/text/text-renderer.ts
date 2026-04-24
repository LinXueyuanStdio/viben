import { Text } from "troika-three-text";
import { darkTheme } from "../theme";
import type { Theme } from "../theme";

export interface TextConfig {
  text: string;
  fontSize?: number;
  color?: string;
  font?: string;
  maxWidth?: number;
  textAlign?: "left" | "center" | "right" | "justify";
  lineHeight?: number;
  anchorX?: "left" | "center" | "right";
  anchorY?: "top" | "top-baseline" | "middle" | "bottom-baseline" | "bottom";
}

export class TextRenderer {
  private _defaultFont: string = "";
  private _theme: Theme = darkTheme;
  private _texts: Set<InstanceType<typeof Text>> = new Set();

  setDefaultFont(fontUrl: string): void {
    this._defaultFont = fontUrl;
  }

  setTheme(theme: Theme): void {
    this._theme = theme;
  }

  createText(config: TextConfig): InstanceType<typeof Text> {
    const mesh = new Text();
    mesh.text = config.text;
    mesh.fontSize = config.fontSize ?? this._theme.fonts.bodySize;
    mesh.color = config.color ?? this._theme.colors.text;
    mesh.font = config.font ?? (this._defaultFont || null);
    mesh.anchorX = config.anchorX ?? "left";
    mesh.anchorY = config.anchorY ?? "top";
    mesh.maxWidth = config.maxWidth ?? Infinity;
    mesh.textAlign = config.textAlign ?? "left";
    mesh.lineHeight = config.lineHeight ?? 1.2;
    mesh.sync();
    this._texts.add(mesh);
    return mesh;
  }

  updateText(
    mesh: InstanceType<typeof Text>,
    config: Partial<TextConfig>,
  ): void {
    if (config.text !== undefined) mesh.text = config.text;
    if (config.fontSize !== undefined) mesh.fontSize = config.fontSize;
    if (config.color !== undefined) mesh.color = config.color;
    if (config.font !== undefined) mesh.font = config.font;
    if (config.maxWidth !== undefined) mesh.maxWidth = config.maxWidth;
    if (config.textAlign !== undefined) mesh.textAlign = config.textAlign;
    if (config.lineHeight !== undefined) mesh.lineHeight = config.lineHeight;
    if (config.anchorX !== undefined) mesh.anchorX = config.anchorX;
    if (config.anchorY !== undefined) mesh.anchorY = config.anchorY;
    mesh.sync();
  }

  disposeText(mesh: InstanceType<typeof Text>): void {
    mesh.removeFromParent();
    mesh.dispose();
    this._texts.delete(mesh);
  }

  dispose(): void {
    for (const mesh of this._texts) {
      mesh.removeFromParent();
      mesh.dispose();
    }
    this._texts.clear();
  }
}

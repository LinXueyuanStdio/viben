import type { Theme } from "./tokens";
import { darkTheme, lightTheme } from "./tokens";

type ThemeListener = (theme: Theme) => void;

export class ThemeManager {
  private _current: Theme;
  private _listeners: ThemeListener[] = [];
  private _themes: Map<string, Theme>;

  constructor(initial: "light" | "dark" = "dark") {
    this._themes = new Map([
      ["dark", darkTheme],
      ["light", lightTheme],
    ]);
    this._current = this._themes.get(initial)!;
  }

  get current(): Theme {
    return this._current;
  }

  setTheme(name: string): void {
    const theme = this._themes.get(name);
    if (!theme || theme === this._current) return;
    this._current = theme;
    for (const fn of this._listeners) fn(theme);
  }

  registerTheme(theme: Theme): void {
    this._themes.set(theme.name, theme);
  }

  onChange(listener: ThemeListener): () => void {
    this._listeners.push(listener);
    return () => {
      const idx = this._listeners.indexOf(listener);
      if (idx !== -1) this._listeners.splice(idx, 1);
    };
  }
}

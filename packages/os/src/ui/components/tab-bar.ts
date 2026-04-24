import { BaseComponent } from "./base-component";
import { Box } from "../primitives/box";
import { darkTheme } from "../theme";
import type { Theme } from "../theme";

export interface TabBarItem { id: string; label: string; icon?: string; }

export interface TabBarConfig {
  width: number;
  height?: number;
  items: TabBarItem[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  theme?: Theme;
}

export class TabBar extends BaseComponent {
  private _box: Box;
  private _items: TabBarItem[];
  private _selectedId: string;
  private _onSelect?: (id: string) => void;

  constructor(config: TabBarConfig) {
    super();
    const theme = config.theme ?? darkTheme;
    this._items = config.items;
    this._selectedId = config.selectedId ?? config.items[0]?.id ?? "";
    this._onSelect = config.onSelect;
    this._box = new Box({ width: config.width, height: config.height ?? 49, backgroundColor: theme.colors.surface });
    this.root.add(this._box.mesh);
    this.root.userData.interactive = true;
  }

  get selectedId(): string { return this._selectedId; }
  get items(): TabBarItem[] { return this._items; }

  select(id: string): void {
    if (this._items.some((item) => item.id === id)) {
      this._selectedId = id;
      this._onSelect?.(id);
    }
  }

  dispose(): void { this._box.dispose(); this._disposed = true; }
}

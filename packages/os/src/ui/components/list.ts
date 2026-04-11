import { Group, Mesh } from "three";
import type { Material } from "three";
import { ScrollView } from "./scroll-view";
import type { ScrollViewConfig } from "./scroll-view";

export interface ListConfig<T> extends ScrollViewConfig {
  itemHeight: number;
  data: T[];
  renderItem: (item: T, index: number) => Group;
}

export class List<T> extends ScrollView {
  private _itemHeight: number;
  private _data: T[];
  private _renderItem: (item: T, index: number) => Group;
  private _itemGroups: Group[] = [];

  constructor(config: ListConfig<T>) {
    super({ width: config.width, height: config.height, contentHeight: config.data.length * config.itemHeight });
    this._itemHeight = config.itemHeight;
    this._data = config.data;
    this._renderItem = config.renderItem;
    this._buildItems();
  }

  setData(data: T[]): void {
    this._clearItems();
    this._data = data;
    this.setContentHeight(data.length * this._itemHeight);
    this._buildItems();
  }

  private _buildItems(): void {
    for (let i = 0; i < this._data.length; i++) {
      const group = this._renderItem(this._data[i], i);
      group.position.y = -i * this._itemHeight;
      this._itemGroups.push(group);
      this.addContent(group);
    }
  }

  private _clearItems(): void {
    for (const g of this._itemGroups) {
      g.traverse((child) => {
        if (child instanceof Mesh) {
          (child.material as Material).dispose();
        }
      });
      g.removeFromParent();
    }
    this._itemGroups.length = 0;
  }

  dispose(): void {
    this._clearItems();
    super.dispose();
  }
}

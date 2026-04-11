import { Group } from "three";
import { BaseComponent } from "./base-component";

export interface ScrollViewConfig {
  width: number;
  height: number;
  contentHeight?: number;
}

export class ScrollView extends BaseComponent {
  readonly contentContainer = new Group();
  private _width: number;
  private _height: number;
  private _contentHeight: number;
  private _scrollOffset = 0;

  constructor(config: ScrollViewConfig) {
    super();
    this._width = config.width;
    this._height = config.height;
    this._contentHeight = config.contentHeight ?? config.height;
    this.root.add(this.contentContainer);
  }

  get scrollOffset(): number { return this._scrollOffset; }
  get maxScroll(): number { return Math.max(0, this._contentHeight - this._height); }

  setContentHeight(h: number): void {
    this._contentHeight = h;
    this._clamp();
  }

  addContent(child: Group): void { this.contentContainer.add(child); }

  scrollTo(offset: number): void {
    this._scrollOffset = offset;
    this._clamp();
    this._applyScroll();
  }

  scrollBy(delta: number): void { this.scrollTo(this._scrollOffset + delta); }

  private _clamp(): void {
    this._scrollOffset = Math.max(0, Math.min(this._scrollOffset, this.maxScroll));
  }

  private _applyScroll(): void {
    this.contentContainer.position.y = this._scrollOffset;
  }

  dispose(): void { this._disposed = true; }
}

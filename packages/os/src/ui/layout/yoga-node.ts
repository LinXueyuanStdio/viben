import type { Node as YNode } from "yoga-wasm-web";
import type { Object3D } from "three";
import {
  DIRECTION_LTR,
  EDGE_LEFT,
  EDGE_TOP,
  EDGE_RIGHT,
  EDGE_BOTTOM,
  EDGE_ALL,
  EDGE_HORIZONTAL,
  EDGE_VERTICAL,
  FLEX_DIRECTION_ROW,
  FLEX_DIRECTION_COLUMN,
  FLEX_DIRECTION_ROW_REVERSE,
  FLEX_DIRECTION_COLUMN_REVERSE,
  JUSTIFY_FLEX_START,
  JUSTIFY_CENTER,
  JUSTIFY_FLEX_END,
  JUSTIFY_SPACE_BETWEEN,
  JUSTIFY_SPACE_AROUND,
  JUSTIFY_SPACE_EVENLY,
  ALIGN_FLEX_START,
  ALIGN_CENTER,
  ALIGN_FLEX_END,
  ALIGN_STRETCH,
  ALIGN_BASELINE,
  POSITION_TYPE_ABSOLUTE,
  POSITION_TYPE_RELATIVE,
  WRAP_NO_WRAP,
  WRAP_WRAP,
  WRAP_WRAP_REVERSE,
  GUTTER_ALL,
} from "yoga-wasm-web";
import type {
  Edge,
  FlexDirection,
  Justify,
  Align,
  PositionType,
  Gutter,
} from "yoga-wasm-web";
import { YogaContext } from "./yoga-context";

type FlexDir = "row" | "column" | "row-reverse" | "column-reverse";
type JustifyContent = "flex-start" | "center" | "flex-end" | "space-between" | "space-around" | "space-evenly";
type AlignItemsType = "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
type EdgeName = "left" | "top" | "right" | "bottom" | "all" | "horizontal" | "vertical";

const FLEX_DIR_MAP: Record<FlexDir, FlexDirection> = {
  "row": FLEX_DIRECTION_ROW,
  "column": FLEX_DIRECTION_COLUMN,
  "row-reverse": FLEX_DIRECTION_ROW_REVERSE,
  "column-reverse": FLEX_DIRECTION_COLUMN_REVERSE,
};

const JUSTIFY_MAP: Record<JustifyContent, Justify> = {
  "flex-start": JUSTIFY_FLEX_START,
  "center": JUSTIFY_CENTER,
  "flex-end": JUSTIFY_FLEX_END,
  "space-between": JUSTIFY_SPACE_BETWEEN,
  "space-around": JUSTIFY_SPACE_AROUND,
  "space-evenly": JUSTIFY_SPACE_EVENLY,
};

const ALIGN_MAP: Record<AlignItemsType, Align> = {
  "flex-start": ALIGN_FLEX_START,
  "center": ALIGN_CENTER,
  "flex-end": ALIGN_FLEX_END,
  "stretch": ALIGN_STRETCH,
  "baseline": ALIGN_BASELINE,
};

const EDGE_MAP: Record<EdgeName, Edge> = {
  "left": EDGE_LEFT,
  "top": EDGE_TOP,
  "right": EDGE_RIGHT,
  "bottom": EDGE_BOTTOM,
  "all": EDGE_ALL,
  "horizontal": EDGE_HORIZONTAL,
  "vertical": EDGE_VERTICAL,
};

export class YogaNode {
  readonly yogaNode: YNode;
  readonly object3D: Object3D;
  private _children: YogaNode[] = [];

  constructor(object3D: Object3D) {
    this.yogaNode = YogaContext.instance.Node.create();
    this.object3D = object3D;
  }

  setWidth(v: number): void { this.yogaNode.setWidth(v); }
  setHeight(v: number): void { this.yogaNode.setHeight(v); }
  setMinWidth(v: number): void { this.yogaNode.setMinWidth(v); }
  setMinHeight(v: number): void { this.yogaNode.setMinHeight(v); }
  setMaxWidth(v: number): void { this.yogaNode.setMaxWidth(v); }
  setMaxHeight(v: number): void { this.yogaNode.setMaxHeight(v); }

  setFlexDirection(dir: FlexDir): void { this.yogaNode.setFlexDirection(FLEX_DIR_MAP[dir]); }
  setJustifyContent(j: JustifyContent): void { this.yogaNode.setJustifyContent(JUSTIFY_MAP[j]); }
  setAlignItems(a: AlignItemsType): void { this.yogaNode.setAlignItems(ALIGN_MAP[a]); }
  setFlexGrow(v: number): void { this.yogaNode.setFlexGrow(v); }
  setFlexShrink(v: number): void { this.yogaNode.setFlexShrink(v); }
  setFlexBasis(v: number | "auto"): void {
    if (v === "auto") this.yogaNode.setFlexBasisAuto();
    else this.yogaNode.setFlexBasis(v);
  }
  setFlexWrap(w: "no-wrap" | "wrap" | "wrap-reverse"): void {
    const map: Record<string, typeof WRAP_NO_WRAP | typeof WRAP_WRAP | typeof WRAP_WRAP_REVERSE> = {
      "no-wrap": WRAP_NO_WRAP,
      "wrap": WRAP_WRAP,
      "wrap-reverse": WRAP_WRAP_REVERSE,
    };
    this.yogaNode.setFlexWrap(map[w]);
  }

  setPadding(edge: EdgeName, v: number): void { this.yogaNode.setPadding(EDGE_MAP[edge], v); }
  setMargin(edge: EdgeName, v: number): void { this.yogaNode.setMargin(EDGE_MAP[edge], v); }
  setGap(v: number): void { this.yogaNode.setGap(GUTTER_ALL as Gutter, v); }

  setPositionType(t: "relative" | "absolute"): void {
    this.yogaNode.setPositionType(
      t === "absolute" ? POSITION_TYPE_ABSOLUTE as PositionType : POSITION_TYPE_RELATIVE as PositionType,
    );
  }
  setPosition(edge: EdgeName, v: number): void { this.yogaNode.setPosition(EDGE_MAP[edge], v); }

  addChild(child: YogaNode): void {
    this.yogaNode.insertChild(child.yogaNode, this._children.length);
    this._children.push(child);
  }

  removeChild(child: YogaNode): void {
    this.yogaNode.removeChild(child.yogaNode);
    const idx = this._children.indexOf(child);
    if (idx !== -1) this._children.splice(idx, 1);
  }

  get computedLeft(): number { return this.yogaNode.getComputedLeft(); }
  get computedTop(): number { return this.yogaNode.getComputedTop(); }
  get computedWidth(): number { return this.yogaNode.getComputedWidth(); }
  get computedHeight(): number { return this.yogaNode.getComputedHeight(); }

  calculateLayout(width?: number, height?: number): void {
    this.yogaNode.calculateLayout(width, height, DIRECTION_LTR);
  }

  syncToObject3D(): void {
    for (const child of this._children) {
      child.object3D.position.x = child.computedLeft;
      child.object3D.position.y = -child.computedTop;
      child.syncToObject3D();
    }
  }

  dispose(): void {
    for (const child of this._children) child.dispose();
    this._children.length = 0;
    this.yogaNode.free();
  }
}

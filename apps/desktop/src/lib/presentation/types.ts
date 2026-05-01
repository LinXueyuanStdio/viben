/**
 * Presentation Mode — Agent tool interface types
 *
 * Agent 通过 PresentationCommand 驱动 tldraw canvas 进行可视化演示。
 */

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** tldraw 内置颜色 */
export type TldrawColor =
  | "black"
  | "grey"
  | "light-violet"
  | "violet"
  | "blue"
  | "light-blue"
  | "yellow"
  | "orange"
  | "green"
  | "light-green"
  | "light-red"
  | "red"
  | "white"

export type PresentationCommand =
  | {
      type: "arrow"
      from: Point
      to: Point
      color?: TldrawColor
      label?: string
      size?: "s" | "m" | "l"
      animate?: boolean
    }
  | {
      type: "highlight"
      region: Rect
      color?: TldrawColor
      animate?: boolean
    }
  | {
      type: "line"
      points: Point[]
      color?: TldrawColor
      size?: "s" | "m" | "l"
      animate?: boolean
    }
  | {
      type: "circle"
      center: Point
      radius: number
      color?: TldrawColor
      animate?: boolean
    }
  | {
      type: "text"
      position: Point
      content: string
      color?: TldrawColor
      size?: "s" | "m" | "l"
    }
  | { type: "clear" }
  | { type: "wait"; ms: number }

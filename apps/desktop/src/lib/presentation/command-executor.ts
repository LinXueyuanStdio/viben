/**
 * Command Executor — 将 PresentationCommand 映射为 tldraw Editor API 调用
 *
 * 纯粹的 "创建形状并返回 ID" 函数，不处理动画。
 * 动画由 command-animator.ts 负责。
 *
 * 参考 tldraw 官方最佳实践:
 * - editor.createShape() 创建形状
 * - editor.run(() => {...}) 事务化批量操作
 * - createShapeId() 生成唯一 ID
 */

import type { Editor } from "tldraw"
import { createShapeId, toRichText } from "tldraw"
import type { PresentationCommand } from "./types"

/**
 * 执行单个命令，返回创建的 shape ID 字符串数组
 */
export function executeCommand(editor: Editor, cmd: PresentationCommand): string[] {
  switch (cmd.type) {
    case "arrow": {
      const id = createShapeId()
      editor.createShape({
        id,
        type: "arrow",
        x: cmd.from.x,
        y: cmd.from.y,
        props: {
          start: { x: 0, y: 0 },
          end: { x: cmd.to.x - cmd.from.x, y: cmd.to.y - cmd.from.y },
          color: cmd.color ?? "red",
          size: cmd.size ?? "m",
          arrowheadEnd: "arrow",
          arrowheadStart: "none",
          ...(cmd.label ? { richText: toRichText(cmd.label) } : {}),
        },
      })
      return [id.toString()]
    }

    case "highlight": {
      const id = createShapeId()
      editor.createShape({
        id,
        type: "geo",
        x: cmd.region.x,
        y: cmd.region.y,
        props: {
          geo: "rectangle",
          w: cmd.region.width,
          h: cmd.region.height,
          color: cmd.color ?? "yellow",
          fill: "semi",
          dash: "dashed",
          size: "m",
        },
      })
      return [id.toString()]
    }

    case "circle": {
      const id = createShapeId()
      editor.createShape({
        id,
        type: "geo",
        x: cmd.center.x - cmd.radius,
        y: cmd.center.y - cmd.radius,
        props: {
          geo: "ellipse",
          w: cmd.radius * 2,
          h: cmd.radius * 2,
          color: cmd.color ?? "red",
          fill: "none",
          size: "m",
        },
      })
      return [id.toString()]
    }

    case "text": {
      const id = createShapeId()
      editor.createShape({
        id,
        type: "text",
        x: cmd.position.x,
        y: cmd.position.y,
        props: {
          richText: toRichText(cmd.content),
          color: cmd.color ?? "black",
          size: cmd.size ?? "m",
        },
      })
      return [id.toString()]
    }

    case "line": {
      if (cmd.points.length < 2) return []
      const origin = cmd.points[0]

      if (cmd.points.length === 2) {
        // Two-point line: create as arrow without arrowheads
        const id = createShapeId()
        editor.createShape({
          id,
          type: "arrow",
          x: origin.x,
          y: origin.y,
          props: {
            start: { x: 0, y: 0 },
            end: { x: cmd.points[1].x - origin.x, y: cmd.points[1].y - origin.y },
            color: cmd.color ?? "red",
            size: cmd.size ?? "m",
            arrowheadEnd: "none",
            arrowheadStart: "none",
          },
        })
        return [id.toString()]
      } else {
        // Multi-point: connect with multiple arrow segments
        const segIds: string[] = []
        editor.run(() => {
          for (let i = 0; i < cmd.points.length - 1; i++) {
            const segId = createShapeId()
            editor.createShape({
              id: segId,
              type: "arrow",
              x: cmd.points[i].x,
              y: cmd.points[i].y,
              props: {
                start: { x: 0, y: 0 },
                end: {
                  x: cmd.points[i + 1].x - cmd.points[i].x,
                  y: cmd.points[i + 1].y - cmd.points[i].y,
                },
                color: cmd.color ?? "red",
                size: cmd.size ?? "m",
                arrowheadEnd: "none",
                arrowheadStart: "none",
              },
            })
            segIds.push(segId.toString())
          }
        })
        return segIds
      }
    }

    case "clear": {
      const allShapes = editor.getCurrentPageShapes()
      if (allShapes.length > 0) {
        editor.deleteShapes(allShapes.map((s) => s.id))
      }
      return []
    }

    case "wait":
      return []
  }
}

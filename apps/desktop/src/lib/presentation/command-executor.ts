/**
 * Command Executor — 将 PresentationCommand 映射为 tldraw Editor API 调用
 *
 * 参考 tldraw 官方最佳实践:
 * - editor.createShape() 创建形状
 * - editor.run(() => {...}) 事务化批量操作
 * - createShapeId() 生成唯一 ID
 * - b64Vecs.encodePoints() 编码 draw shape 点数据
 */

import type { Editor } from "tldraw"
import { createShapeId, toRichText } from "tldraw"
import type { PresentationCommand } from "./types"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function executeCommand(editor: Editor, cmd: PresentationCommand): void {
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
      if (cmd.animate) {
        editor.updateShape({ id, type: "arrow", opacity: 0 })
        requestAnimationFrame(() => {
          editor.updateShape({ id, type: "arrow", opacity: 1 })
        })
      }
      break
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
      if (cmd.animate) {
        editor.updateShape({ id, type: "geo", opacity: 0 })
        requestAnimationFrame(() => {
          editor.updateShape({ id, type: "geo", opacity: 1 })
        })
      }
      break
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
      if (cmd.animate) {
        editor.updateShape({ id, type: "geo", opacity: 0 })
        requestAnimationFrame(() => {
          editor.updateShape({ id, type: "geo", opacity: 1 })
        })
      }
      break
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
      break
    }

    case "line": {
      if (cmd.points.length < 2) break
      const id = createShapeId()
      const origin = cmd.points[0]
      // Use geo line shape with points for simplicity
      // For freehand, we'd use draw shape with b64Vecs encoding
      const points = cmd.points.map((p) => ({ x: p.x - origin.x, y: p.y - origin.y }))

      // Create as arrow without arrowheads for simple line
      if (cmd.points.length === 2) {
        editor.createShape({
          id,
          type: "arrow",
          x: origin.x,
          y: origin.y,
          props: {
            start: { x: 0, y: 0 },
            end: { x: points[1].x, y: points[1].y },
            color: cmd.color ?? "red",
            size: cmd.size ?? "m",
            arrowheadEnd: "none",
            arrowheadStart: "none",
          },
        })
      } else {
        // Multi-point: use draw shape
        // Simplified approach - connect with multiple arrow segments
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
          }
        })
      }
      if (cmd.animate) {
        editor.updateShape({ id, type: "arrow", opacity: 0 })
        requestAnimationFrame(() => {
          editor.updateShape({ id, type: "arrow", opacity: 1 })
        })
      }
      break
    }

    case "clear": {
      const allShapes = editor.getCurrentPageShapes()
      if (allShapes.length > 0) {
        editor.deleteShapes(allShapes.map((s) => s.id))
      }
      break
    }

    case "wait":
      // Handled by executeQueue
      break
  }
}

/**
 * 执行命令队列 — 逐个消费，支持 wait 延时和最小间隔
 */
export async function executeQueue(
  editor: Editor,
  commands: PresentationCommand[],
  signal?: AbortSignal
): Promise<void> {
  for (const cmd of commands) {
    if (signal?.aborted) break

    if (cmd.type === "wait") {
      await sleep(cmd.ms)
    } else {
      executeCommand(editor, cmd)
      // 最小间隔保证视觉节奏
      await sleep(50)
    }
  }
}

/**
 * 执行单个命令 (实时模式，Agent 逐条发送)
 */
export { executeCommand }

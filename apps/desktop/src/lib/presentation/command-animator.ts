/**
 * Command Animator — 统一的命令动画系统
 *
 * 替代旧的 per-shape `cmd.animate` 标志，提供统一的动画控制。
 * PresentationLayer 为每个 step 调用 animateCommand，并使用返回的 handle 跟踪/控制动画。
 * 暂停时调用 handle.finish() 立即完成当前动画。
 */

import type { Editor } from "tldraw"
import type { PresentationCommand } from "./types"
import { executeCommand } from "./command-executor"

const ANIM_DURATION = 300

export interface AnimationHandle {
  /** 立即完成动画，跳到最终状态 */
  finish: () => void
  /** 动画完成的 Promise */
  done: Promise<void>
}

/**
 * 对单个命令执行带动画的展示
 */
export function animateCommand(editor: Editor, cmd: PresentationCommand): AnimationHandle {
  // clear: 立即删除所有形状
  if (cmd.type === "clear") {
    executeCommand(editor, cmd)
    return resolvedHandle()
  }

  // wait: 等待指定时间
  if (cmd.type === "wait") {
    let resolve: () => void
    const done = new Promise<void>((r) => {
      resolve = r
    })
    const timer = setTimeout(() => {
      resolve!()
    }, cmd.ms)

    return {
      finish: () => {
        clearTimeout(timer)
        resolve!()
      },
      done,
    }
  }

  // Drawing commands: arrow, highlight, circle, text, line
  // Create shapes directly at opacity 0 (no flash)
  const shapeIds = executeCommand(editor, cmd, 0)

  if (shapeIds.length === 0) {
    return resolvedHandle()
  }

  // Animate opacity 0 -> 1
  let resolve: () => void
  const done = new Promise<void>((r) => {
    resolve = r
  })

  const startTime = performance.now()
  let rafId: number | null = null

  const tick = () => {
    const elapsed = performance.now() - startTime
    const progress = Math.min(elapsed / ANIM_DURATION, 1)

    for (const id of shapeIds) {
      const shape = editor.getShape(id as any)
      if (shape) {
        editor.updateShape({ id: id as any, type: shape.type, opacity: progress })
      }
    }

    if (progress < 1) {
      rafId = requestAnimationFrame(tick)
    } else {
      rafId = null
      resolve!()
    }
  }

  rafId = requestAnimationFrame(tick)

  return {
    finish: () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      for (const id of shapeIds) {
        const shape = editor.getShape(id as any)
        if (shape) {
          editor.updateShape({ id: id as any, type: shape.type, opacity: 1 })
        }
      }
      resolve!()
    },
    done,
  }
}

/**
 * 重放到指定步骤 — 清除画布后立即重建到 targetIndex 的状态
 *
 * 用于用户在暂停状态下跳转到不同步骤。
 */
export function replayToStep(
  editor: Editor,
  steps: Array<{ command: PresentationCommand }>,
  targetIndex: number,
): void {
  // 清除画布
  const allShapes = editor.getCurrentPageShapes()
  if (allShapes.length > 0) {
    editor.deleteShapes(allShapes.map((s) => s.id))
  }

  // 重放 0..targetIndex (inclusive)
  for (let i = 0; i <= targetIndex; i++) {
    const step = steps[i]
    if (!step) continue

    const cmd = step.command

    // 跳过 wait
    if (cmd.type === "wait") continue

    // clear 删除当前所有形状
    if (cmd.type === "clear") {
      const shapes = editor.getCurrentPageShapes()
      if (shapes.length > 0) {
        editor.deleteShapes(shapes.map((s) => s.id))
      }
      continue
    }

    // Drawing commands: 直接执行，形状以完整透明度出现
    executeCommand(editor, cmd)
  }
}

/** 创建一个立即完成的 handle */
function resolvedHandle(): AnimationHandle {
  return {
    finish: () => {},
    done: Promise.resolve(),
  }
}

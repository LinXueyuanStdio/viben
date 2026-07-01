const COVER_WIDTH = 1200
const COVER_HEIGHT = 630

/**
 * 从预览 DOM 元素截取 1200×630 PNG blob，用于页面自动封面。
 * 失败返回 null（不阻塞发布流程）。
 */
export async function captureHtmlCover(el: HTMLElement): Promise<Blob | null> {
  try {
    const { toPng } = await import("html-to-image")
    const dataUrl = await toPng(el, {
      width: COVER_WIDTH,
      height: COVER_HEIGHT,
      pixelRatio: 1,
    })
    const res = await fetch(dataUrl)
    return await res.blob()
  } catch (error) {
    console.warn("Failed to capture HTML cover:", error)
    return null
  }
}

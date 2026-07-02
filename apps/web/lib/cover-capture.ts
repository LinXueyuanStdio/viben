const COVER_WIDTH = 1200
const COVER_HEIGHT = 630

const BASE_STYLE = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    line-height: 1.6;
    color: #1a1a1a;
    background: #fff;
    width: ${COVER_WIDTH}px;
    min-height: ${COVER_HEIGHT}px;
    overflow: hidden;
  }
  img { max-width: 100%; height: auto; }
  pre { overflow-x: auto; background: #f5f5f5; padding: 1rem; border-radius: 4px; font-size: 0.85em; }
  code { font-size: 0.9em; }
  h1 { font-size: 2rem; margin-bottom: 0.5rem; }
  h2 { font-size: 1.5rem; margin-bottom: 0.4rem; }
  h3 { font-size: 1.2rem; margin-bottom: 0.3rem; }
  p { margin-bottom: 0.5rem; }
`

/**
 * 在独立的离屏容器中以 1200×630 渲染 HTML 并截图为 PNG blob。
 * 失败返回 null（不阻塞发布流程）。
 */
export async function captureHtmlCover(html: string): Promise<Blob | null> {
  const container = document.createElement("div")
  container.style.cssText =
    `position:fixed;top:-9999px;left:-9999px;width:${COVER_WIDTH}px;min-height:${COVER_HEIGHT}px;overflow:hidden;z-index:-1;background:#fff`
  container.innerHTML = `<style>${BASE_STYLE}</style>${html}`

  document.body.appendChild(container)

  try {
    // 等待浏览器完成布局
    await new Promise((resolve) => setTimeout(resolve, 100))

    const { toPng } = await import("html-to-image")
    const dataUrl = await toPng(container, {
      width: COVER_WIDTH,
      height: COVER_HEIGHT,
      pixelRatio: 1,
    })
    const res = await fetch(dataUrl)
    return await res.blob()
  } catch (error) {
    console.warn("Failed to capture HTML cover:", error)
    return null
  } finally {
    document.body.removeChild(container)
  }
}

declare module 'region-screenshot-js' {
  interface RegionScreenshotOptions {
    downloadName?: string;
    regionColor?: string;
    maskColor?: string;
    globalColorOptions?: string[];
    regionSizeIndicator?: Record<string, unknown>;
    rectangleOptions?: { color?: string[]; size?: number[] };
    circleOptions?: { color?: string[]; size?: number[] };
    paintOptions?: { color?: string[]; size?: number[] };
    mosaicOptions?: { size?: number[] };
    textOptions?: { color?: string[]; size?: number[] };
    arrowOptions?: { color?: string[]; size?: number[] };
    initialRegion?: { top?: number; left?: number; width?: number; height?: number };
    customDrawing?: Array<{
      className?: string;
      optionsHtml?: string;
      onDrawingOpen?: (canvas: HTMLCanvasElement, options: HTMLElement, save: () => void) => void;
    }>;
  }

  type RegionScreenshotEvent =
    | 'screenshotGenerated'
    | 'screenshotDownload'
    | 'regionDragging'
    | 'regionDragStart'
    | 'regionDragEnd'
    | 'successCreated'
    | 'errorCreated'
    | 'closed';

  class RegionScreenshot {
    constructor(options?: RegionScreenshotOptions);
    on(event: RegionScreenshotEvent, callback: (...args: unknown[]) => void): void;
    destroy(): void;
  }

  export default RegionScreenshot;
}

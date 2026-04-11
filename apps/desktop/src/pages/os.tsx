import { useEffect, useRef } from "react";
import { Renderer, RenderScheduler } from "@viben/os";

export function OsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    const renderer = new Renderer(canvas);
    let cleanup: (() => void) | undefined;

    (async () => {
      await renderer.init();
      if (disposed) {
        renderer.dispose();
        return;
      }

      renderer.resize(window.innerWidth, window.innerHeight);

      const scheduler = new RenderScheduler((dt) => {
        renderer.render();
      });
      scheduler.markDirty();

      const onResize = () => {
        renderer.resize(window.innerWidth, window.innerHeight);
        scheduler.markDirty();
      };
      window.addEventListener("resize", onResize);

      cleanup = () => {
        window.removeEventListener("resize", onResize);
        scheduler.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      <textarea
        ref={textareaRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none",
        }}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}

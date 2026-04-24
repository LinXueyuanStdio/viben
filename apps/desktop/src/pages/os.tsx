import { useEffect, useRef } from "react";
import { Renderer, RenderScheduler } from "@viben/os";

export function OsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    const renderer = new Renderer(canvas);

    (async () => {
      await renderer.init();
      if (disposed) {
        renderer.dispose();
        return;
      }

      renderer.resize(window.innerWidth, window.innerHeight);

      const scheduler = new RenderScheduler((_dt) => {
        renderer.render();
      });
      if (disposed) {
        scheduler.dispose();
        renderer.dispose();
        return;
      }
      scheduler.markDirty();

      const onResize = () => {
        renderer.resize(window.innerWidth, window.innerHeight);
        scheduler.markDirty();
      };
      window.addEventListener("resize", onResize);

      // Check once more after all setup — if disposed during setup, tear down immediately
      if (disposed) {
        window.removeEventListener("resize", onResize);
        scheduler.dispose();
        renderer.dispose();
        return;
      }

      // Store cleanup function in ref for effect cleanup
      cleanupRef.current = () => {
        window.removeEventListener("resize", onResize);
        scheduler.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      // If async setup completed, cleanup is in ref; otherwise renderer.dispose() handles it
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      } else {
        // Async init still pending — it will check `disposed` and clean up itself
        renderer.dispose();
      }
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

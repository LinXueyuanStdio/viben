// apps/desktop/src/pages/pet-window/index.tsx
import { useEffect, useState, useCallback, useRef } from "react";
import { getCurrentWindow, PhysicalPosition, availableMonitors } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen } from "@tauri-apps/api/event";
import { PetSprite, type PetConfig, type PetInteraction } from "@viben/pet";
import { fetchPetConfigFromGateway, loadPetConfig, type PetConfigResponse } from "@/lib/pet-loader";
import { getGatewayClient } from "@/lib/gateway";
import { useAnalytics } from "@/lib/analytics";
import { AnalyticsEvents } from "@/lib/analytics/types";

async function openChatWindow() {
  try {
    const chatWindow = await WebviewWindow.getByLabel("chat-window");
    if (chatWindow) {
      await chatWindow.show();
      await chatWindow.setFocus();
      return;
    }
    const newWindow = new WebviewWindow("chat-window", {
      url: "/chat-window.html",
      title: "Chat",
      width: 420,
      height: 600,
      minWidth: 360,
      minHeight: 400,
      titleBarStyle: "overlay",
      hiddenTitle: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: true,
      shadow: true,
      focus: true,
    });
    await newWindow.once("tauri://error", (e) => {
      console.error("[PetWindow] Failed to create chat window:", e.payload);
    });
  } catch (err) {
    console.error("[PetWindow] Failed to open chat window:", err);
  }
}

async function updatePetPosition(right: number, bottom: number): Promise<void> {
  try {
    await getGatewayClient().request<void>("/api/pet/config", {
      method: "PUT",
      body: { preferences: { position: { right, bottom } } },
      responseType: "none",
    });
  } catch {
    // Ignore errors
  }
}

const PET_SIZE = 96;
const WINDOW_PADDING = 16;
const WINDOW_SIZE = PET_SIZE + WINDOW_PADDING * 2;

const DRAG_GESTURE_MIN_PX = 5;
const DRAG_AXIS_BIAS = 1.3;

export default function PetWindowPage() {
  const { logEvent } = useAnalytics();
  const [pet, setPet] = useState<PetConfig | null>(null);
  const [config, setConfig] = useState<PetConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [interaction, setInteraction] = useState<PetInteraction>("idle");
  const [isDragging, setIsDragging] = useState(false);

  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load config and pet
  useEffect(() => {
    let mounted = true;

    async function init() {
      const cfg = await fetchPetConfigFromGateway();
      if (!mounted) return;

      setConfig(cfg);

      if (!cfg?.enabled || !cfg.current) {
        const win = getCurrentWindow();
        await win.hide();
        setPet(null);
        setLoading(false);
        return;
      }

      try {
        const petData = await loadPetConfig(cfg.current);
        if (!mounted) return;
        setPet(petData);

        const win = getCurrentWindow();
        const monitors = await availableMonitors();
        const primaryMonitor = monitors[0];

        if (primaryMonitor) {
          const screenWidth = primaryMonitor.size.width;
          const screenHeight = primaryMonitor.size.height;

          let x: number;
          let y: number;

          if (cfg.preferences?.position) {
            x = screenWidth - cfg.preferences.position.right - WINDOW_SIZE;
            y = screenHeight - cfg.preferences.position.bottom - WINDOW_SIZE;
          } else {
            x = Math.round((screenWidth - WINDOW_SIZE) / 2);
            y = Math.round((screenHeight - WINDOW_SIZE) / 2);
          }

          await win.setPosition(new PhysicalPosition(x, y));
        }

        await win.show();

        // Track pet displayed
        try {
          logEvent(AnalyticsEvents.PET_DISPLAYED, {
            pet_type: petData.id || "default",
            pet_name: petData.name || "pet",
          });
        } catch {}
      } catch (err) {
        console.error("[PetWindow] Failed to load pet:", err);
      }

      setLoading(false);
    }

    init();
    return () => { mounted = false; };
  }, [reloadKey]);

  // Listen for config changes from settings
  useEffect(() => {
    const unlisten = listen("pet-config-changed", () => {
      setReloadKey((k) => k + 1);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const wasDraggedRef = useRef(false);

  // Handle window dragging via Tauri native drag
  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    // Record start position to detect if it was a click or drag
    dragStartPosRef.current = { x: e.screenX, y: e.screenY };
    wasDraggedRef.current = false;
    setIsDragging(true);

    const win = getCurrentWindow();
    const pos = await win.outerPosition();
    lastPosRef.current = { x: pos.x, y: pos.y };

    // Blocks until drag ends
    await win.startDragging();

    // Drag ended
    setIsDragging(false);
    setInteraction("idle");
    lastPosRef.current = null;
  }, []);

  // Handle click to open chat window (only if not dragged)
  const handleClick = useCallback(() => {
    // If dragged more than threshold, don't open chat
    if (wasDraggedRef.current) {
      wasDraggedRef.current = false;
      return;
    }
    try {
      logEvent(AnalyticsEvents.PET_CLICKED, {
        pet_type: pet?.id || "default",
        previous_animation: interaction,
      });
      logEvent(AnalyticsEvents.PET_CHAT_OPENED, {
        pet_type: pet?.id || "default",
      });
    } catch {}
    openChatWindow();
  }, [pet, interaction, logEvent]);

  // Detect drag direction from tauri://move events (stable subscription, no deps on state)
  useEffect(() => {
    let saveTimeoutId: ReturnType<typeof setTimeout>;

    const unlisten = listen<{ x: number; y: number }>("tauri://move", (event) => {
      console.log("[PetWindow] tauri://move event:", event.payload);
      const { x, y } = event.payload;
      const lastPos = lastPosRef.current;

      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }

      if (lastPos) {
        const dx = x - lastPos.x;
        const dy = y - lastPos.y;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (absX >= DRAG_GESTURE_MIN_PX || absY >= DRAG_GESTURE_MIN_PX) {
          // Mark as dragged so click handler knows not to open chat
          wasDraggedRef.current = true;

          if (absX >= absY * DRAG_AXIS_BIAS) {
            const newInteraction = dx > 0 ? "drag-right" : "drag-left";
            console.log("[PetWindow] Setting interaction:", newInteraction);
            setInteraction(newInteraction);
          } else if (absY >= absX * DRAG_AXIS_BIAS) {
            const newInteraction = dy > 0 ? "drag-down" : "drag-up";
            console.log("[PetWindow] Setting interaction:", newInteraction);
            setInteraction(newInteraction);
          }
        }
      }

      lastPosRef.current = { x, y };

      idleTimeoutRef.current = setTimeout(() => {
        setInteraction("idle");
      }, 150);

      // Debounce save position
      clearTimeout(saveTimeoutId);
      saveTimeoutId = setTimeout(async () => {
        const monitors = await availableMonitors();
        const primaryMonitor = monitors[0];
        if (primaryMonitor) {
          const screenWidth = primaryMonitor.size.width;
          const screenHeight = primaryMonitor.size.height;
          const right = screenWidth - x - WINDOW_SIZE;
          const bottom = screenHeight - y - WINDOW_SIZE;
          await updatePetPosition(right, bottom);
        }
      }, 500);
    });

    return () => {
      clearTimeout(saveTimeoutId);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      unlisten.then((fn) => fn());
    };
  }, []);

  // Hover interaction
  const handleMouseEnter = useCallback(() => {
    if (!isDragging) setInteraction("hover");
  }, [isDragging]);

  const handleMouseLeave = useCallback(() => {
    if (!isDragging) setInteraction("idle");
  }, [isDragging]);

  const getRowId = (): string => {
    switch (interaction) {
      case "drag-left": return "walk-left";
      case "drag-right": return "walk-right";
      case "drag-up": return "jump";
      case "drag-down": return "fall";
      case "hover": return "alert";
      default: return "idle";
    }
  };

  if (loading || !config?.enabled || !pet) {
    return <div style={{ width: "100vw", height: "100vh", background: "transparent" }} />;
  }

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "transparent",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: isDragging ? "grabbing" : "pointer",
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <PetSprite pet={pet} rowId={getRowId()} size={PET_SIZE} />
    </div>
  );
}

// apps/desktop/src/pages/pet-window/index.tsx
import { useEffect, useState, useCallback, useRef } from "react";
import { getCurrentWindow, PhysicalPosition, availableMonitors } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { PetSprite, type PetConfig, type PetInteraction, STANDARD_ANIMATIONS, PET_DEFAULTS } from "@viben/pet";
import { loadPetFromPublic } from "@/lib/pet-loader";
import { getGatewayClient } from "@/lib/gateway";

interface PetConfigResponse {
  current: string | null;
  enabled: boolean;
  preferences: {
    size: number;
    position: { right: number; bottom: number } | null;
  };
}

async function fetchPetConfig(): Promise<PetConfigResponse | null> {
  try {
    const data = await getGatewayClient().get<{ config: PetConfigResponse }>("/api/pet/config");
    return data.config;
  } catch {
    return null;
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
      const cfg = await fetchPetConfig();
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
        let petData: PetConfig;
        try {
          petData = await loadPetFromPublic(cfg.current);
        } catch {
          const gatewayClient = getGatewayClient();
          const { pet: petInfo } = await gatewayClient.get<{
            pet: {
              id: string;
              metadata: {
                display_name: string;
                description: string;
              };
              spritesheet_url: string;
            };
          }>(`/api/pet/show/${encodeURIComponent(cfg.current)}`);
          let spritesheetSrc = petInfo.spritesheet_url;
          if (spritesheetSrc.startsWith("/api/")) {
            spritesheetSrc = `${gatewayClient.getBaseUrl()}${spritesheetSrc}`;
          }
          petData = {
            id: petInfo.id,
            name: petInfo.metadata.display_name,
            description: petInfo.metadata.description,
            accent: "#6366f1",
            greeting: `Hi! I'm ${petInfo.metadata.display_name}.`,
            spritesheet: spritesheetSrc,
            atlas: {
              cols: 8,
              rows: 9,
              cellWidth: 192,
              cellHeight: 208,
              animations: STANDARD_ANIMATIONS,
            },
            ambient: PET_DEFAULTS.ambient,
            idleTimeoutMs: PET_DEFAULTS.idleTimeoutMs,
          };
        }
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

          if (cfg.preferences.position) {
            x = screenWidth - cfg.preferences.position.right - WINDOW_SIZE;
            y = screenHeight - cfg.preferences.position.bottom - WINDOW_SIZE;
          } else {
            x = Math.round((screenWidth - WINDOW_SIZE) / 2);
            y = Math.round((screenHeight - WINDOW_SIZE) / 2);
          }

          await win.setPosition(new PhysicalPosition(x, y));
        }

        await win.show();
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

  // Handle window dragging via Tauri native drag
  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    if (e.button !== 0) return;

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
        cursor: isDragging ? "grabbing" : "grab",
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <PetSprite pet={pet} rowId={getRowId()} size={PET_SIZE} />
    </div>
  );
}

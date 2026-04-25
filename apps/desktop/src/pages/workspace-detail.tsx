import { useEffect, useRef, useCallback, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Settings,
  FileText,
  MessageCircle,
  KanbanSquare,
  Clock,
  Bot,
  FolderOpen,
  Lightbulb,
  Activity,
  Smartphone,
  Loader2,
} from "lucide-react";
import { Renderer, RenderScheduler } from "@viben/os";
import { useLocalWorkspaces } from "@/hooks";
import { cn } from "@/lib/utils";
import { PageAppGrid } from "./apps/components/page-app-grid";
import { GRADIENT_COLORS, getPageGradientColors } from "./apps/utils/gradient-colors";
import type { GradientColorKey } from "./apps/utils/gradient-colors";

// Re-export for backward compatibility
export { GRADIENT_COLORS, type GradientColorKey, getPageGradientColors };

interface AppInfo {
  id: string;
  name: string;
  icon: React.ElementType;
  path: string;
  gradient: GradientColorKey;
  isSystem?: boolean;
}

// Gaussian-based magnification for smooth macOS-style dock effect
function getIconScale(index: number, hoveredIndex: number | null, maxScale = 1.6): number {
  if (hoveredIndex === null) return 1;
  const distance = Math.abs(index - hoveredIndex);
  if (distance > 3) return 1;
  // Gaussian falloff
  const sigma = 1.2;
  return 1 + (maxScale - 1) * Math.exp(-(distance * distance) / (2 * sigma * sigma));
}

function getTranslateY(scale: number): number {
  return -(scale - 1) * 28;
}

/**
 * WorkspaceDetailPage - macOS-style workspace home with Dock
 */
export function WorkspaceDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { getWorkspace, isLoading } = useLocalWorkspaces();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [clickedApp, setClickedApp] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Initialize Three.js renderer
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

      const container = canvas.parentElement;
      if (!container) return;

      renderer.resize(container.clientWidth, container.clientHeight);

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
        if (container) {
          renderer.resize(container.clientWidth, container.clientHeight);
          scheduler.markDirty();
        }
      };
      window.addEventListener("resize", onResize);

      if (disposed) {
        window.removeEventListener("resize", onResize);
        scheduler.dispose();
        renderer.dispose();
        return;
      }

      cleanupRef.current = () => {
        window.removeEventListener("resize", onResize);
        scheduler.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      } else {
        renderer.dispose();
      }
    };
  }, []);

  // Workspace apps
  const workspaceApps: AppInfo[] = workspaceId ? [
    { id: "chat", name: t("workspace.chat"), icon: MessageCircle, path: `/workspace/${workspaceId}/chat`, gradient: "green" },
    { id: "kanban", name: t("workspace.kanban"), icon: KanbanSquare, path: `/workspace/${workspaceId}/kanban`, gradient: "violet" },
    { id: "cron", name: t("workspace.scheduledTasks"), icon: Clock, path: `/workspace/${workspaceId}/cron`, gradient: "orange" },
    { id: "ideas", name: t("workspace.ideas"), icon: Lightbulb, path: `/workspace/${workspaceId}/ideas`, gradient: "yellow" },
    { id: "agents", name: t("workspace.sections.agents"), icon: Bot, path: `/workspace/${workspaceId}/agents`, gradient: "cyan" },
    { id: "files", name: t("workspace.files"), icon: FolderOpen, path: `/workspace/${workspaceId}/files`, gradient: "blue" },
    { id: "monitor", name: t("workspace.chatMonitor"), icon: Activity, path: `/workspace/${workspaceId}/chat-monitor`, gradient: "rose" },
  ] : [];

  // System apps
  const systemApps: AppInfo[] = [
    { id: "settings", name: t("nav.settings"), icon: Settings, path: "/settings", gradient: "zinc", isSystem: true },
    { id: "documents", name: t("nav.documents"), icon: FileText, path: "/documents", gradient: "sky", isSystem: true },
    { id: "devices", name: t("nav.devices"), icon: Smartphone, path: "/devices/pair", gradient: "purple", isSystem: true },
  ];

  // All dock apps with separator marker
  const dockItems: (AppInfo | "separator")[] = [
    ...workspaceApps,
    ...(workspaceApps.length > 0 ? ["separator" as const] : []),
    ...systemApps,
  ];

  const handleAppClick = useCallback((app: AppInfo) => {
    setClickedApp(app.id);
    // Bounce animation then navigate
    setTimeout(() => {
      setClickedApp(null);
      navigate(app.path);
    }, 400);
  }, [navigate]);

  // Check if app is "running" (current route starts with app path)
  const isAppRunning = useCallback((app: AppInfo) => {
    return location.pathname.startsWith(app.path);
  }, [location.pathname]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, _index: number, app: AppInfo) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleAppClick(app);
    }
  }, [handleAppClick]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Wallpaper Background - using inline styles for gradients to ensure they work in Tailwind v4 */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(to bottom right, #0f172a, #581c87, #0f172a)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at top, rgba(29, 78, 216, 0.2), transparent, transparent)",
        }}
      />

      {/* Three.js Canvas Overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full opacity-30 pointer-events-none"
        style={{ mixBlendMode: "soft-light" }}
      />

      {/* Desktop Area */}
      <div className="relative z-10 h-full flex flex-col">
        {/* Menu Bar */}
        <div
          className="h-7 flex items-center px-4 text-[13px]"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            backdropFilter: "blur(40px)",
            WebkitBackdropFilter: "blur(40px)",
            color: "rgba(255, 255, 255, 0.9)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
          }}
        >
          <div className="flex items-center gap-4">
            <span className="font-semibold">
              {workspace?.type === "global" ? t("workspace.global") : workspace?.name || "Viben"}
            </span>
            <span style={{ color: "rgba(255, 255, 255, 0.5)" }}>
              {t("nav.documents")}
            </span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3" style={{ color: "rgba(255, 255, 255, 0.8)" }}>
            <span>
              {currentTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
            <span>
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Main Desktop - Page App Grid (iPad home screen) */}
        <div className="flex-1 relative overflow-hidden">
          {workspace && workspaceId ? (
            <PageAppGrid
              workspaceId={workspaceId}
              workspacePath={workspace.path}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center" style={{ color: "rgba(255, 255, 255, 0.6)" }}>
                <div className="text-lg font-medium mb-2">
                  {workspace?.type === "global" ? t("workspace.global") : workspace?.name || "Viben"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dock */}
        <div className="flex justify-center pb-3" role="menubar" aria-label="Dock">
          <div
            className={cn(
              "flex items-end gap-1 px-3 pt-2.5 pb-2 rounded-2xl"
            )}
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
            }}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {dockItems.map((item, index) => {
              if (item === "separator") {
                return (
                  <div
                    key="separator"
                    className="self-center mx-2"
                    style={{
                      width: "1px",
                      height: "48px",
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                    }}
                  />
                );
              }

              const app = item;
              const appIndex = dockItems.filter((i, idx) => i !== "separator" && idx <= index).length - 1;
              const scale = getIconScale(appIndex, hoveredIndex);
              const translateY = getTranslateY(scale);
              const isRunning = isAppRunning(app);
              const isBouncing = clickedApp === app.id;

              return (
                <DockIcon
                  key={app.id}
                  app={app}
                  scale={scale}
                  translateY={translateY}
                  isRunning={isRunning}
                  isBouncing={isBouncing}
                  onHover={() => setHoveredIndex(appIndex)}
                  onClick={() => handleAppClick(app)}
                  onKeyDown={(e) => handleKeyDown(e, appIndex, app)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* CSS for dock bounce animation */}
      <style>{`
        @keyframes dock-bounce {
          0%, 100% {
            transform: scale(var(--dock-scale, 1)) translateY(var(--dock-translate-y, 0px));
          }
          25% {
            transform: scale(var(--dock-scale, 1)) translateY(calc(var(--dock-translate-y, 0px) - 20px));
          }
          50% {
            transform: scale(var(--dock-scale, 1)) translateY(var(--dock-translate-y, 0px));
          }
          75% {
            transform: scale(var(--dock-scale, 1)) translateY(calc(var(--dock-translate-y, 0px) - 10px));
          }
        }
        .dock-bounce {
          animation: dock-bounce 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
}

interface DockIconProps {
  app: AppInfo;
  scale: number;
  translateY: number;
  isRunning: boolean;
  isBouncing: boolean;
  onHover: () => void;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

function DockIcon({
  app,
  scale,
  translateY,
  isRunning,
  isBouncing,
  onHover,
  onClick,
  onKeyDown,
}: DockIconProps) {
  const Icon = app.icon;
  const isHovered = scale > 1.1;
  const gradientColors = GRADIENT_COLORS[app.gradient];

  return (
    <div className="relative flex flex-col items-center px-1">
      {/* Tooltip */}
      <div
        className={cn(
          "absolute -top-10 px-3 py-1.5 rounded-md text-xs whitespace-nowrap",
          "transition-all duration-200",
          isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none"
        )}
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.9)",
          color: "white",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
        }}
      >
        {app.name}
        {/* Tooltip arrow */}
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            borderRight: "1px solid rgba(255, 255, 255, 0.1)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        />
      </div>

      {/* Icon Button */}
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={onHover}
        onKeyDown={onKeyDown}
        tabIndex={0}
        aria-label={app.name}
        role="menuitem"
        className={cn(
          "relative outline-none rounded-xl",
          isBouncing && "dock-bounce"
        )}
        style={{
          "--dock-scale": scale,
          "--dock-translate-y": `${translateY}px`,
          transform: `scale(${scale}) translateY(${translateY}px)`,
          transition: isBouncing ? "none" : "transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        } as React.CSSProperties}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{
            background: `linear-gradient(to bottom right, ${gradientColors.from}, ${gradientColors.to})`,
            boxShadow: `0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
            border: "1px solid rgba(255, 255, 255, 0.15)",
          }}
        >
          <Icon className="h-6 w-6 text-white" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))" }} />
        </div>

        {/* Subtle shine/reflection at top */}
        <div
          className="absolute inset-x-1 top-0.5 h-4 rounded-t-lg pointer-events-none"
          style={{
            background: "linear-gradient(to bottom, rgba(255,255,255,0.25), transparent)",
            borderRadius: "10px 10px 0 0",
          }}
        />
      </button>

      {/* Running indicator dot */}
      <div
        className={cn(
          "w-1.5 h-1.5 rounded-full mt-1 transition-opacity duration-200"
        )}
        style={{
          backgroundColor: isRunning ? "rgba(255, 255, 255, 0.9)" : "transparent",
          opacity: isRunning ? 1 : 0,
          boxShadow: isRunning ? "0 0 4px rgba(255, 255, 255, 0.5)" : "none",
        }}
      />
    </div>
  );
}

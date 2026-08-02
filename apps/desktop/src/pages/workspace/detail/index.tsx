import { useEffect, useRef, useCallback, useState } from "react";
import { useParams } from "react-router-dom";
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
import { useDesktopRouting } from "@/hooks/use-desktop-routing";
import { getWorkspaceSectionDescriptor } from "@/navigation/navigation-meta";
import type { WorkspaceSection } from "@/navigation/navigation-meta";
import { cn } from "@/lib/utils";
import { WorkspaceHeader } from "@/components/workspace";
import { PageWrapper } from "@/components/layout";
import { PageIconGrid } from "../../apps/components/page-app-grid";
import { GRADIENT_COLORS } from "@/lib/gradient-colors";
import type { GradientColorKey } from "@/lib/gradient-colors";
import "./workspace-detail.css";

interface AppInfo {
  id: string;
  name: string;
  icon: React.ElementType;
  section?: WorkspaceSection;
  gradient: GradientColorKey;
  isSystem?: boolean;
}


/**
 * WorkspaceDetailPage - macOS-style workspace home with Dock
 */
export function WorkspaceDetailPage() {
  const { t } = useTranslation();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { getWorkspace, isLoading } = useLocalWorkspaces();
  const {
    openWorkspaceSection,
    openSettings,
    openDocuments,
    openDevicePair,
  } = useDesktopRouting();
  const [hoveredApp, setHoveredApp] = useState<string | null>(null);
  const [clickedApp, setClickedApp] = useState<string | null>(null);

  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;
  const agentDescriptor = getWorkspaceSectionDescriptor("agent");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up navigate timer on unmount
  useEffect(() => {
    return () => {
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
    };
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

      const observer = new ResizeObserver(() => {
        if (container) {
          renderer.resize(container.clientWidth, container.clientHeight);
          scheduler.markDirty();
        }
      });
      observer.observe(container);

      if (disposed) {
        observer.disconnect();
        scheduler.dispose();
        renderer.dispose();
        return;
      }

      cleanupRef.current = () => {
        observer.disconnect();
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
    { id: "chat", name: t("workspace.chat"), icon: MessageCircle, section: "chat", gradient: "green" },
    { id: "kanban", name: t("workspace.kanban"), icon: KanbanSquare, section: "kanban", gradient: "violet" },
    { id: "cron", name: t("workspace.scheduledTasks"), icon: Clock, section: "cron", gradient: "orange" },
    { id: "ideas", name: t("workspace.ideas"), icon: Lightbulb, section: "ideas", gradient: "yellow" },
    {
      id: "agents",
      name: agentDescriptor
        ? t(agentDescriptor.titleKey, agentDescriptor.fallbackLabel)
        : t("workspace.sections.agents"),
      icon: Bot,
      section: "agent",
      gradient: "cyan",
    },
    { id: "files", name: t("workspace.files"), icon: FolderOpen, section: "files", gradient: "blue" },
    { id: "monitor", name: t("workspace.chatMonitor"), icon: Activity, section: "chat-monitor", gradient: "rose" },
  ] : [];

  // System apps
  const systemApps: AppInfo[] = [
    { id: "settings", name: t("nav.settings"), icon: Settings, gradient: "zinc", isSystem: true },
    { id: "documents", name: t("nav.documents"), icon: FileText, gradient: "sky", isSystem: true },
    { id: "devices", name: t("nav.devices"), icon: Smartphone, gradient: "purple", isSystem: true },
  ];

  // All dock apps with separator marker
  const dockItems: (AppInfo | "separator")[] = [
    ...workspaceApps,
    ...(workspaceApps.length > 0 ? ["separator" as const] : []),
    ...systemApps,
  ];

  const handleAppClick = useCallback((app: AppInfo) => {
    if (navigateTimerRef.current) {
      clearTimeout(navigateTimerRef.current);
    }
    setClickedApp(app.id);
    navigateTimerRef.current = setTimeout(() => {
      navigateTimerRef.current = null;
      setClickedApp(null);
      switch (app.id) {
        case "settings":
          openSettings(undefined, { openMode: "reuse" });
          return;
        case "documents":
          openDocuments({ openMode: "reuse" });
          return;
        case "devices":
          openDevicePair({ openMode: "reuse" });
          return;
        default:
          if (workspaceId && app.section) {
            openWorkspaceSection(workspaceId, app.section, { openMode: "reuse" });
          }
          return;
      }
    }, 400);
  }, [openDevicePair, openDocuments, openSettings, openWorkspaceSection, workspaceId]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, app: AppInfo) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleAppClick(app);
    }
  }, [handleAppClick]);

  // Loading state
  if (isLoading) {
    return (
      <PageWrapper className="flex flex-col h-full">
        <div className="flex items-center justify-center h-full bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="flex flex-col h-full">
      <div className="relative flex-1 overflow-hidden">
        {/* Wallpaper Background */}
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
          {/* Header with breadcrumb - transparent over dark background */}
          {workspace && (
            <WorkspaceHeader
              workspace={workspace}
              showRefresh={false}
              showRemove={false}
            />
          )}
          {/* Main Desktop - Page App Grid (iPad home screen) */}
          <div className="flex-1 relative overflow-hidden min-h-0">
            {workspace && workspaceId ? (
              <PageIconGrid
                workspaceId={workspaceId}
                workspacePath={workspace.path}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center" style={{ color: "rgba(255, 255, 255, 0.6)" }}>
                  <div className="text-lg font-medium mb-2">
                    {workspace?.id === "global" ? t("workspace.global") : workspace?.name || "Viben"}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Dock */}
          <div className="flex justify-center pb-6 px-4" role="menubar" aria-label={t("workspaceDetail.dockLabel")}>
            <div
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                backdropFilter: "saturate(180%) blur(24px)",
                WebkitBackdropFilter: "saturate(180%) blur(24px)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
              }}
              onMouseLeave={() => setHoveredApp(null)}
            >
              {dockItems.map((item) => {
                if (item === "separator") {
                  return (
                    <div
                      key="separator"
                      role="separator"
                      aria-orientation="vertical"
                      className="self-center mx-1.5"
                      style={{
                        width: "1px",
                        height: "32px",
                        backgroundColor: "rgba(255, 255, 255, 0.2)",
                      }}
                    />
                  );
                }

                const app = item;
                const isBouncing = clickedApp === app.id;
                const isHovered = hoveredApp === app.id;

                return (
                  <DockIcon
                    key={app.id}
                    app={app}
                    isHovered={isHovered}
                    isBouncing={isBouncing}
                    onHover={() => setHoveredApp(app.id)}
                    onClick={() => handleAppClick(app)}
                    onKeyDown={(e) => handleKeyDown(e, app)}
                  />
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </PageWrapper>
  );
}

interface DockIconProps {
  app: AppInfo;
  isHovered: boolean;
  isBouncing: boolean;
  onHover: () => void;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

function DockIcon({
  app,
  isHovered,
  isBouncing,
  onHover,
  onClick,
  onKeyDown,
}: DockIconProps) {
  const Icon = app.icon;
  const gradientColors = GRADIENT_COLORS[app.gradient];

  return (
    <div className="relative flex flex-col items-center">
      {/* Tooltip - appears above on hover */}
      <div
        className={cn(
          "absolute -top-9 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md text-xs whitespace-nowrap",
          "transition-[opacity,transform] duration-150",
          isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none"
        )}
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          color: "white",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
        }}
      >
        {app.name}
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.85)",
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
          "relative outline-none rounded-[14px] transition-transform duration-150 ease-out",
          "hover:scale-105 active:scale-95",
          isBouncing && "dock-bounce"
        )}
      >
        <div
          className="w-12 h-12 rounded-[14px] flex items-center justify-center"
          style={{
            background: `linear-gradient(to bottom right, ${gradientColors.from}, ${gradientColors.to})`,
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
          }}
        >
          <Icon className="h-6 w-6 text-white" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))" }} />
        </div>

        {/* Subtle shine */}
        <div
          className="absolute inset-x-1 top-0.5 h-3 rounded-t-[12px] pointer-events-none"
          style={{
            background: "linear-gradient(to bottom, rgba(255,255,255,0.10), transparent)",
          }}
        />
      </button>
    </div>
  );
}

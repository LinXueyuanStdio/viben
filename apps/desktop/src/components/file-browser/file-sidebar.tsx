import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Star,
  HardDrive,
  Clock,
  Folder,
  Home,
  Download,
  FileText,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Common system folder paths (macOS)
const SYSTEM_FOLDERS = {
  desktop: {
    path: () => {
      const home = getHomePath();
      return home ? `${home}/Desktop` : null;
    },
    icon: Home,
    labelKey: "fileBrowser.desktop",
  },
  downloads: {
    path: () => {
      const home = getHomePath();
      return home ? `${home}/Downloads` : null;
    },
    icon: Download,
    labelKey: "fileBrowser.downloads",
  },
  documents: {
    path: () => {
      const home = getHomePath();
      return home ? `${home}/Documents` : null;
    },
    icon: FileText,
    labelKey: "fileBrowser.documents",
  },
};

/**
 * Get home directory path from environment or common patterns
 */
function getHomePath(): string | null {
  // In Tauri, we can detect the home path from the workspace path
  // For now, use a heuristic based on common patterns
  if (typeof window !== "undefined") {
    // Try to extract from localStorage or use common macOS path
    const stored = localStorage.getItem("user_home_path");
    if (stored) return stored;

    // Fallback: detect from common patterns (macOS)
    // This will be properly set when we know the workspace path
    return null;
  }
  return null;
}

/**
 * Extract home path from a given path
 */
function extractHomePath(path: string): string | null {
  // macOS: /Users/username/...
  const macMatch = path.match(/^(\/Users\/[^/]+)/);
  if (macMatch) return macMatch[1];

  // Linux: /home/username/...
  const linuxMatch = path.match(/^(\/home\/[^/]+)/);
  if (linuxMatch) return linuxMatch[1];

  // Windows: C:\Users\username\...
  const winMatch = path.match(/^([A-Za-z]:\\Users\\[^\\]+)/);
  if (winMatch) return winMatch[1];

  return null;
}

/**
 * Get the folder name from a full path
 */
function getFolderName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/**
 * Shorten path for display (use ~ for home)
 */
function shortenPath(path: string, homePath: string | null): string {
  if (!homePath) return path;
  if (path.startsWith(homePath)) {
    return "~" + path.slice(homePath.length);
  }
  return path;
}

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  path: string;
  isSelected: boolean;
  onClick: () => void;
  secondaryText?: string;
}

function SidebarItem({
  icon: Icon,
  label,
  isSelected,
  onClick,
  secondaryText,
}: SidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
        "transition-colors duration-150",
        isSelected
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          isSelected ? "text-primary" : "text-muted-foreground"
        )}
      />
      <div className="flex-1 min-w-0">
        <span className="truncate block">{label}</span>
        {secondaryText && (
          <span className="text-xs text-muted-foreground/70 truncate block">
            {secondaryText}
          </span>
        )}
      </div>
    </button>
  );
}

interface SidebarSectionProps {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function SidebarSection({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
}: SidebarSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-1.5 px-2 py-1.5 rounded-md",
            "text-xs font-semibold uppercase tracking-wider text-muted-foreground",
            "hover:bg-accent/30 transition-colors"
          )}
        >
          {isOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <Icon className="h-3 w-3" />
          <span>{title}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5 mt-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export interface FileSidebarProps {
  /** The workspace root path */
  workspacePath: string;
  /** Currently selected/viewed path */
  currentPath: string;
  /** Callback when a path is selected */
  onNavigate: (path: string) => void;
  /** Recently visited paths */
  recentPaths?: string[];
  /** Additional class name */
  className?: string;
}

/**
 * File browser sidebar component with Finder-style navigation.
 *
 * Features:
 * - Favorites section with workspace root and system folders
 * - Locations section showing current workspace
 * - Recent section for recently visited paths
 * - Collapsible sections with smooth animations
 * - Selected item highlighting
 */
export function FileSidebar({
  workspacePath,
  currentPath,
  onNavigate,
  recentPaths = [],
  className,
}: FileSidebarProps) {
  const { t } = useTranslation();

  // Extract home path from workspace path
  const homePath = React.useMemo(() => {
    const extracted = extractHomePath(workspacePath);
    if (extracted) {
      // Store for future use
      localStorage.setItem("user_home_path", extracted);
    }
    return extracted;
  }, [workspacePath]);

  // Build favorites list
  const favorites = React.useMemo(() => {
    const items: Array<{
      id: string;
      path: string;
      icon: React.ElementType;
      label: string;
    }> = [];

    // Always add workspace root
    items.push({
      id: "workspace",
      path: workspacePath,
      icon: Folder,
      label: getFolderName(workspacePath),
    });

    // Add system folders if accessible (based on detected home path)
    if (homePath) {
      Object.entries(SYSTEM_FOLDERS).forEach(([key, config]) => {
        const path = config.path();
        if (path && path !== workspacePath) {
          items.push({
            id: key,
            path,
            icon: config.icon,
            label: t(config.labelKey, key.charAt(0).toUpperCase() + key.slice(1)),
          });
        }
      });
    }

    return items;
  }, [workspacePath, homePath, t]);

  // Filter recent paths (remove current and duplicates, limit to 10)
  const filteredRecent = React.useMemo(() => {
    const seen = new Set<string>();
    return recentPaths
      .filter((path) => {
        if (path === currentPath || seen.has(path)) return false;
        seen.add(path);
        return true;
      })
      .slice(0, 10);
  }, [recentPaths, currentPath]);

  // Get workspace name for locations section
  const workspaceName = React.useMemo(
    () => getFolderName(workspacePath),
    [workspacePath]
  );

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-muted/30 border-r border-border",
        className
      )}
    >
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-4">
          {/* Favorites Section */}
          <SidebarSection
            title={t("fileBrowser.favorites", "Favorites")}
            icon={Star}
            defaultOpen
          >
            {favorites.map((item) => (
              <SidebarItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                path={item.path}
                isSelected={currentPath === item.path}
                onClick={() => onNavigate(item.path)}
              />
            ))}
          </SidebarSection>

          {/* Locations Section */}
          <SidebarSection
            title={t("fileBrowser.locations", "Locations")}
            icon={HardDrive}
            defaultOpen
          >
            <SidebarItem
              icon={Folder}
              label={workspaceName}
              path={workspacePath}
              isSelected={currentPath === workspacePath}
              onClick={() => onNavigate(workspacePath)}
              secondaryText={shortenPath(workspacePath, homePath)}
            />
          </SidebarSection>

          {/* Recent Section */}
          {filteredRecent.length > 0 && (
            <SidebarSection
              title={t("fileBrowser.recent", "Recent")}
              icon={Clock}
              defaultOpen
            >
              {filteredRecent.map((path, index) => (
                <SidebarItem
                  key={`${path}-${index}`}
                  icon={Folder}
                  label={getFolderName(path)}
                  path={path}
                  isSelected={currentPath === path}
                  onClick={() => onNavigate(path)}
                  secondaryText={shortenPath(path, homePath)}
                />
              ))}
            </SidebarSection>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default FileSidebar;

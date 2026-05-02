import { useTranslation } from "react-i18next";
import { LogOut, Settings, User, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";

interface UserMenuProps {
  /** Whether the sidebar is collapsed */
  collapsed?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * User menu component with avatar and dropdown.
 *
 * Features:
 * - Avatar display with fallback initials
 * - User name/email display
 * - Dropdown menu with profile, settings, logout
 *
 * @example
 * ```tsx
 * <UserMenu />
 *
 * // In collapsed sidebar
 * <UserMenu collapsed />
 * ```
 */
export function UserMenu({ collapsed = false, className }: UserMenuProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { openDashboard, openSettings } = useDesktopRouting();

  if (!user) return null;

  // Get initials from display name or username
  const getInitials = (name: string): string => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const initials = getInitials(user.displayName || user.username);

  const handleLogout = async () => {
    await logout();
    openDashboard();
  };

  const handleProfileClick = () => {
    // Open profile page in browser (web platform)
    window.open("https://viben-web.vercel.app/profile", "_blank");
  };

  const handleSettingsClick = () => {
    openSettings();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 rounded-lg p-2 w-full",
            "text-left transition-colors duration-200",
            "hover:bg-sidebar-accent",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            collapsed && "justify-center",
            className
          )}
        >
          <Avatar size="default">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName} />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user.displayName || user.username}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={collapsed ? "center" : "start"} className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{user.displayName || user.username}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleProfileClick}>
          <User className="mr-2 h-4 w-4" />
          {t("auth.profile")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSettingsClick}>
          <Settings className="mr-2 h-4 w-4" />
          {t("auth.settings")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t("auth.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

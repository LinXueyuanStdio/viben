import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SidebarIconButton } from "@/components/layout/sidebar-icon-button";
import { syncChannels } from "@/hooks";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";
import { cn } from "@/lib/utils";
import { SECTIONS } from "./constants";
import { getSettingsSectionFromPathname } from "./settings-sidebar-utils";
import type { SettingsSection } from "./types";

interface SettingsSidebarContentProps {
  collapsed: boolean;
  showExpanded: boolean;
}

export function SettingsSidebarContent({
  collapsed,
  showExpanded,
}: SettingsSidebarContentProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const { openSettings } = useDesktopRouting();
  const activeSection = getSettingsSectionFromPathname(location.pathname);

  const handleSectionChange = useCallback(
    (section: SettingsSection) => {
      openSettings(section, { stackMode: "replace" });
      if (section === "channels") {
        syncChannels();
      }
    },
    [openSettings],
  );

  if (collapsed && !showExpanded) {
    return (
      <div className="flex flex-col gap-1">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const title = t(section.labelKey);
          const isActive = activeSection === section.id;

          return (
            <div key={section.id} className="grid w-full place-items-center">
              <SidebarIconButton
                icon={
                  <Icon className={cn("h-4 w-4", isActive && "text-primary")} />
                }
                tooltip={title}
                onClick={() => handleSectionChange(section.id)}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <nav className="flex flex-col gap-1">
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const title = t(section.labelKey);
        const isActive = activeSection === section.id;

        return (
          <button
            key={section.id}
            type="button"
            onClick={() => handleSectionChange(section.id)}
            className={cn(
              "group relative flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm",
              "transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? [
                    "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                    "before:absolute before:left-0 before:top-1/2 before:h-6 before:w-1",
                    "before:-translate-y-1/2 before:rounded-r-full before:bg-primary",
                  ]
                : [
                    "text-sidebar-foreground/70",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  ],
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0 transition-colors duration-200",
                "group-hover:text-primary",
                isActive && "text-primary",
              )}
            />
            <span className="truncate">{title}</span>
          </button>
        );
      })}
    </nav>
  );
}

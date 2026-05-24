import { useState, useCallback, useEffect } from "react";
import { syncChannels } from "@/hooks";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";
import type { SettingsSection } from "./types";
import {
  DEFAULT_SETTINGS_SECTION,
  SECTIONS,
  VALID_SECTIONS,
  easeOutExpo,
} from "./constants";
import { GeneralSection } from "./general-section";
import { AccountSection } from "./account-section";
import { ShortcutsSection } from "./shortcuts-section";
import { NotificationsSection } from "./notifications-section";
import { SettingsGatewayPage } from "./settings-gateway";
import { SettingsChannelsPage } from "./settings-channels";
import { SettingsExecutorsPage } from "./settings-executors";
import { SettingsModelPage } from "./settings-model";
import { SettingsAgentsPage } from "./settings-agents";
import { SettingsMcpPage } from "./settings-mcp";
import { SettingsSkillsPage } from "./settings-skills";
import { SettingsSandboxPage } from "./settings-sandbox";
import { EnvironmentSection } from "./environment-section";
import { TerminalFontsSection } from "./terminal-fonts-section";
import { SettingsOverlay } from "./settings-overlay";
import { SettingsVoice } from "./settings-voice";
import { StorageSection } from "./storage-section";
import { DeveloperSection } from "./developer-section";
import { AboutSection } from "./about-section";

export function SettingsPage() {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const location = useLocation();
  const { openSettings } = useDesktopRouting();

  // Get section from URL path (e.g., /settings/agents -> "agents")
  const getSectionFromPath = (): SettingsSection => {
    const pathSection = location.pathname.split("/settings/")[1];
    if (pathSection && VALID_SECTIONS.includes(pathSection as SettingsSection)) {
      return pathSection as SettingsSection;
    }
    return DEFAULT_SETTINGS_SECTION;
  };

  const [activeSection, setActiveSection] = useState<SettingsSection>(
    getSectionFromPath
  );

  // Sync URL with active section (used in sidebar navigation)
  // Pre-load data when navigating to certain sections
  const handleSectionChange = useCallback((section: SettingsSection) => {
    setActiveSection(section);
    openSettings(section);

    // Pre-sync channel data when navigating to channels section
    if (section === "channels") {
      syncChannels();
    }
  }, [openSettings]);

  // Update active section when URL changes
  useEffect(() => {
    const sectionFromPath = getSectionFromPath();
    if (sectionFromPath !== activeSection) {
      setActiveSection(sectionFromPath);
    }
    // Pre-sync data for specific sections on URL change (deep link support)
    if (sectionFromPath === "channels") {
      syncChannels();
    }
  }, [location.pathname]);

  // Animation variants for content transitions
  const tabContentVariants = {
    initial: {
      opacity: 0,
      x: prefersReducedMotion ? 0 : 20,
    },
    animate: {
      opacity: 1,
      x: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.3,
        ease: easeOutExpo,
      },
    },
    exit: {
      opacity: 0,
      x: prefersReducedMotion ? 0 : -20,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.2,
      },
    },
  };

  // Container animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.05,
        delayChildren: prefersReducedMotion ? 0 : 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.3,
        ease: easeOutExpo,
      },
    },
  };

  // Render section content
  const renderSectionContent = () => {
    switch (activeSection) {
      case "general":
        return <GeneralSection key="general" />;
      case "account":
        return <AccountSection key="account" />;
      case "shortcuts":
        return <ShortcutsSection key="shortcuts" />;
      case "notifications":
        return <NotificationsSection key="notifications" />;
      case "gateway":
        return <SettingsGatewayPage key="gateway" />;
      case "channels":
        return <SettingsChannelsPage key="channels" />;
      case "executors":
        return <SettingsExecutorsPage key="executors" />;
      case "model":
        return <SettingsModelPage key="model" />;
      case "agents":
        return <SettingsAgentsPage key="agents" />;
      case "mcp":
        return <SettingsMcpPage key="mcp" />;
      case "skills":
        return <SettingsSkillsPage key="skills" />;
      case "sandbox":
        return <SettingsSandboxPage key="sandbox" />;
      case "environment":
        return <EnvironmentSection key="environment" />;
      case "terminalFonts":
        return <TerminalFontsSection key="terminalFonts" />;
      case "overlay":
        return <SettingsOverlay key="overlay" />;
      case "voice":
        return <SettingsVoice key="voice" />;
      case "storage":
        return <StorageSection key="storage" />;
      case "developer":
        return <DeveloperSection key="developer" />;
      case "about":
        return <AboutSection key="about" />;
      default:
        return null;
    }
  };

  return (
    <motion.div
        className="h-full flex flex-col md:flex-row"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Left Navigation Sidebar */}
        <motion.nav
          className="w-56 shrink-0 border-b md:border-b-0 md:border-r bg-muted/30 overflow-hidden whitespace-nowrap flex flex-col"
          variants={itemVariants}
          initial="visible"
        >
          {/* Navigation items */}
          <ul className="space-y-1 py-4 px-2 overflow-y-auto flex-1 min-h-0">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;

              return (
                <li key={section.id}>
                  <button
                    onClick={() => handleSectionChange(section.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm",
                      "transition-all duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      isActive
                        ? [
                            "bg-primary text-primary-foreground font-medium",
                            "shadow-sm",
                          ]
                        : [
                            "text-muted-foreground",
                            "hover:bg-muted hover:text-foreground",
                          ]
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        "transition-transform duration-200",
                        isActive && "scale-110"
                      )}
                    />
                    <span>{t(section.labelKey)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </motion.nav>

      {/* Right Content Area */}
      <div className={cn(
        "flex-1 overflow-auto",
        // Full-width pages need no padding
        ["agents", "mcp", "skills"].includes(activeSection) ? "" : "p-6"
      )}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            variants={tabContentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn(
              // Full-width pages need full height
              ["agents", "mcp", "skills"].includes(activeSection) ? "h-full" : "max-w-2xl"
            )}
          >
            {renderSectionContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

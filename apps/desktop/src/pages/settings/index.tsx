import { useState, useEffect } from "react";
import { syncChannels } from "@/hooks";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";
import type { SettingsSection } from "./types";
import { easeOutExpo } from "./constants";
import { getSettingsSectionFromPathname } from "./settings-sidebar-utils";
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
import { PetSection } from "./pet-section";

export function SettingsPage() {
  const prefersReducedMotion = useReducedMotion();
  const location = useLocation();

  const [activeSection, setActiveSection] = useState<SettingsSection>(() =>
    getSettingsSectionFromPathname(location.pathname)
  );

  // Update active section when URL changes
  useEffect(() => {
    const sectionFromPath = getSettingsSectionFromPathname(location.pathname);
    setActiveSection((current) =>
      sectionFromPath === current ? current : sectionFromPath
    );
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
      case "pet":
        return <PetSection key="pet" />;
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
      className="h-full"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div
        className={cn(
          "h-full overflow-auto",
          ["agents", "mcp", "skills"].includes(activeSection) ? "" : "p-6",
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            variants={tabContentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn(
              ["agents", "mcp", "skills"].includes(activeSection)
                ? "h-full"
                : "max-w-2xl",
            )}
          >
            {renderSectionContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

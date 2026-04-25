import type React from "react";

// Settings section type
export type SettingsSection = "general" | "account" | "shortcuts" | "notifications" | "gateway" | "channels" | "executors" | "model" | "agents" | "mcp" | "skills" | "sandbox" | "environment" | "terminalFonts" | "overlay" | "voice" | "storage" | "developer" | "about";

// Section configuration
export interface SectionConfig {
  id: SettingsSection;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

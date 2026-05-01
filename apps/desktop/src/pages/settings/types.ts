import type React from "react";
import type { SettingsSection as NavigationSettingsSection } from "@/navigation/navigation-meta";

export type SettingsSection = NavigationSettingsSection;

// Section configuration
export interface SectionConfig {
  id: SettingsSection;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

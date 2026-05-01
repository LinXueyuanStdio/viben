import type React from "react";
import type { SettingsSection } from "@/navigation/navigation-meta";

// Section configuration
export interface SectionConfig {
  id: SettingsSection;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

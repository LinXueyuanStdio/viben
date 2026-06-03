/**
 * Settings section configuration utilities.
 *
 * This module provides the icon component mapping and configuration
 * functions needed to render settings navigation items.
 */

import {
  Settings,
  User,
  Keyboard,
  Bell,
  Network,
  MessageSquare,
  Play,
  Cpu,
  Bot,
  Box,
  Sparkles,
  Bug,
  Terminal,
  HardDrive,
  Info,
  Type,
  Layers,
  Mic,
  Cat,
} from "lucide-react";
import { Boxes } from "lucide-react";
import type { SettingsSection } from "./navigation-meta";
import {
  SETTINGS_SECTIONS,
  VALID_SETTINGS_SECTIONS,
  getSettingsSectionDescriptor,
} from "./navigation-meta";
import type { SettingsSectionInfo } from "./navigation-meta";

// Section configuration type
export interface SectionConfig {
  id: SettingsSection;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SETTINGS_ICON_COMPONENTS = {
  settings: Settings,
  user: User,
  keyboard: Keyboard,
  bell: Bell,
  network: Network,
  "message-square": MessageSquare,
  play: Play,
  cpu: Cpu,
  bot: Bot,
  boxes: Boxes,
  sparkles: Sparkles,
  box: Box,
  terminal: Terminal,
  type: Type,
  layers: Layers,
  mic: Mic,
  cat: Cat,
  "hard-drive": HardDrive,
  bug: Bug,
  info: Info,
} as const;

export const DEFAULT_SETTINGS_SECTION: SettingsSection = "general";

export function getSettingsIconComponent(
  iconValue?: string
): SectionConfig["icon"] {
  return (
    SETTINGS_ICON_COMPONENTS[
      (iconValue ?? "settings") as keyof typeof SETTINGS_ICON_COMPONENTS
    ] ?? Settings
  );
}

export function toSectionConfig(
  section: SettingsSectionInfo
): SectionConfig {
  return {
    id: section.section,
    labelKey: section.titleKey,
    icon: getSettingsIconComponent(section.icon.value),
  };
}

export const SECTIONS: SectionConfig[] =
  SETTINGS_SECTIONS.map(toSectionConfig);

export function getSettingsSectionConfig(
  section?: SettingsSection
): SectionConfig | undefined {
  const descriptor = getSettingsSectionDescriptor(section);
  return descriptor ? toSectionConfig(descriptor) : undefined;
}

// Valid sections for nested routes
export const VALID_SECTIONS: SettingsSection[] = VALID_SETTINGS_SECTIONS;

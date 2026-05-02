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
} from "lucide-react";
import { Boxes } from "lucide-react";
import type { SettingsSection, SectionConfig } from "./types";
import {
  SETTINGS_SECTION_DESCRIPTORS,
  VALID_SETTINGS_SECTIONS,
  getSettingsSectionDescriptor,
} from "@/navigation/navigation-meta";
import type { SettingsSectionDescriptor } from "@/navigation/navigation-meta";

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
  section: SettingsSectionDescriptor
): SectionConfig {
  return {
    id: section.section,
    labelKey: section.titleKey,
    icon: getSettingsIconComponent(section.icon.value),
  };
}

export const SECTIONS: SectionConfig[] =
  SETTINGS_SECTION_DESCRIPTORS.map(toSectionConfig);

export function getSettingsSectionConfig(
  section?: SettingsSection
): SectionConfig | undefined {
  const descriptor = getSettingsSectionDescriptor(section);
  return descriptor ? toSectionConfig(descriptor) : undefined;
}

// Valid sections for nested routes
export const VALID_SECTIONS: SettingsSection[] = VALID_SETTINGS_SECTIONS;

// Common timezones with i18n keys for display names
export const TIMEZONES = [
  { value: "Pacific/Honolulu", labelKey: "settings.timezones.pacificHonolulu" },
  { value: "America/Anchorage", labelKey: "settings.timezones.americaAnchorage" },
  { value: "America/Los_Angeles", labelKey: "settings.timezones.americaLosAngeles" },
  { value: "America/Denver", labelKey: "settings.timezones.americaDenver" },
  { value: "America/Chicago", labelKey: "settings.timezones.americaChicago" },
  { value: "America/New_York", labelKey: "settings.timezones.americaNewYork" },
  { value: "America/Sao_Paulo", labelKey: "settings.timezones.americaSaoPaulo" },
  { value: "Atlantic/Azores", labelKey: "settings.timezones.atlanticAzores" },
  { value: "Europe/London", labelKey: "settings.timezones.europeLondon" },
  { value: "Europe/Paris", labelKey: "settings.timezones.europeParis" },
  { value: "Europe/Berlin", labelKey: "settings.timezones.europeBerlin" },
  { value: "Africa/Cairo", labelKey: "settings.timezones.africaCairo" },
  { value: "Europe/Moscow", labelKey: "settings.timezones.europeMoscow" },
  { value: "Asia/Dubai", labelKey: "settings.timezones.asiaDubai" },
  { value: "Asia/Karachi", labelKey: "settings.timezones.asiaKarachi" },
  { value: "Asia/Kolkata", labelKey: "settings.timezones.asiaKolkata" },
  { value: "Asia/Dhaka", labelKey: "settings.timezones.asiaDhaka" },
  { value: "Asia/Bangkok", labelKey: "settings.timezones.asiaBangkok" },
  { value: "Asia/Shanghai", labelKey: "settings.timezones.asiaShanghai" },
  { value: "Asia/Hong_Kong", labelKey: "settings.timezones.asiaHongKong" },
  { value: "Asia/Singapore", labelKey: "settings.timezones.asiaSingapore" },
  { value: "Asia/Tokyo", labelKey: "settings.timezones.asiaTokyo" },
  { value: "Asia/Seoul", labelKey: "settings.timezones.asiaSeoul" },
  { value: "Australia/Sydney", labelKey: "settings.timezones.australiaSydney" },
  { value: "Pacific/Auckland", labelKey: "settings.timezones.pacificAuckland" },
];

// Easing curves
export const easeOutExpo = [0.16, 1, 0.3, 1] as const;

// LocalStorage key for settings sidebar collapsed state
export const SETTINGS_SIDEBAR_COLLAPSED_KEY = "settings-sidebar-collapsed";

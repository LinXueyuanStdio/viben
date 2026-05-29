/**
 * Settings page constants.
 *
 * Note: Settings section config and icon mappings have moved to
 * @/navigation/settings-sections.ts for better module organization.
 */

// Re-export from navigation module
export {
  DEFAULT_SETTINGS_SECTION,
  getSettingsIconComponent,
  toSectionConfig,
  SECTIONS,
  getSettingsSectionConfig,
  VALID_SECTIONS,
} from "@/navigation/settings-sections";
export type { SectionConfig } from "@/navigation/settings-sections";

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

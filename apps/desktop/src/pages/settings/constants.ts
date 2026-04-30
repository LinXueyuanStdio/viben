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

export const SECTIONS: SectionConfig[] = [
  { id: "general", labelKey: "settings.sections.general", icon: Settings },
  { id: "account", labelKey: "settings.sections.account", icon: User },
  { id: "shortcuts", labelKey: "settings.sections.shortcuts", icon: Keyboard },
  { id: "notifications", labelKey: "settings.sections.notifications", icon: Bell },
  { id: "gateway", labelKey: "settings.sections.gateway", icon: Network },
  { id: "channels", labelKey: "settings.sections.channels", icon: MessageSquare },
  { id: "executors", labelKey: "settings.sections.executors", icon: Play },
  { id: "model", labelKey: "settings.sections.model", icon: Cpu },
  { id: "agents", labelKey: "settings.sections.agents", icon: Bot },
  { id: "mcp", labelKey: "settings.sections.mcp", icon: Boxes },
  { id: "skills", labelKey: "settings.sections.skills", icon: Sparkles },
  { id: "sandbox", labelKey: "settings.sections.sandbox", icon: Box },
  { id: "environment", labelKey: "settings.sections.environment", icon: Terminal },
  { id: "terminalFonts", labelKey: "settings.sections.terminalFonts", icon: Type },
  { id: "overlay", labelKey: "settings.sections.overlay", icon: Layers },
  { id: "voice", labelKey: "settings.sections.voice", icon: Mic },
  { id: "storage", labelKey: "settings.sections.storage", icon: HardDrive },
  { id: "developer", labelKey: "settings.sections.developer", icon: Bug },
  { id: "about", labelKey: "settings.sections.about", icon: Info },
];

// Valid sections for nested routes
export const VALID_SECTIONS: SettingsSection[] = ["general", "account", "shortcuts", "notifications", "gateway", "channels", "executors", "model", "agents", "mcp", "skills", "sandbox", "environment", "terminalFonts", "overlay", "voice", "storage", "developer", "about"];

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

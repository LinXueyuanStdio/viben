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

// Common timezones with their display names
export const TIMEZONES = [
  { value: "Pacific/Honolulu", label: "(GMT-10:00) Honolulu", labelZh: "(GMT-10:00) 檀香山" },
  { value: "America/Anchorage", label: "(GMT-9:00) Alaska", labelZh: "(GMT-9:00) 阿拉斯加" },
  { value: "America/Los_Angeles", label: "(GMT-8:00) Los Angeles", labelZh: "(GMT-8:00) 洛杉矶" },
  { value: "America/Denver", label: "(GMT-7:00) Denver", labelZh: "(GMT-7:00) 丹佛" },
  { value: "America/Chicago", label: "(GMT-6:00) Chicago", labelZh: "(GMT-6:00) 芝加哥" },
  { value: "America/New_York", label: "(GMT-5:00) New York", labelZh: "(GMT-5:00) 纽约" },
  { value: "America/Sao_Paulo", label: "(GMT-3:00) Sao Paulo", labelZh: "(GMT-3:00) 圣保罗" },
  { value: "Atlantic/Azores", label: "(GMT-1:00) Azores", labelZh: "(GMT-1:00) 亚速尔群岛" },
  { value: "Europe/London", label: "(GMT+0:00) London", labelZh: "(GMT+0:00) 伦敦" },
  { value: "Europe/Paris", label: "(GMT+1:00) Paris", labelZh: "(GMT+1:00) 巴黎" },
  { value: "Europe/Berlin", label: "(GMT+1:00) Berlin", labelZh: "(GMT+1:00) 柏林" },
  { value: "Africa/Cairo", label: "(GMT+2:00) Cairo", labelZh: "(GMT+2:00) 开罗" },
  { value: "Europe/Moscow", label: "(GMT+3:00) Moscow", labelZh: "(GMT+3:00) 莫斯科" },
  { value: "Asia/Dubai", label: "(GMT+4:00) Dubai", labelZh: "(GMT+4:00) 迪拜" },
  { value: "Asia/Karachi", label: "(GMT+5:00) Karachi", labelZh: "(GMT+5:00) 卡拉奇" },
  { value: "Asia/Kolkata", label: "(GMT+5:30) Mumbai", labelZh: "(GMT+5:30) 孟买" },
  { value: "Asia/Dhaka", label: "(GMT+6:00) Dhaka", labelZh: "(GMT+6:00) 达卡" },
  { value: "Asia/Bangkok", label: "(GMT+7:00) Bangkok", labelZh: "(GMT+7:00) 曼谷" },
  { value: "Asia/Shanghai", label: "(GMT+8:00) Shanghai", labelZh: "(GMT+8:00) 上海" },
  { value: "Asia/Hong_Kong", label: "(GMT+8:00) Hong Kong", labelZh: "(GMT+8:00) 香港" },
  { value: "Asia/Singapore", label: "(GMT+8:00) Singapore", labelZh: "(GMT+8:00) 新加坡" },
  { value: "Asia/Tokyo", label: "(GMT+9:00) Tokyo", labelZh: "(GMT+9:00) 东京" },
  { value: "Asia/Seoul", label: "(GMT+9:00) Seoul", labelZh: "(GMT+9:00) 首尔" },
  { value: "Australia/Sydney", label: "(GMT+10:00) Sydney", labelZh: "(GMT+10:00) 悉尼" },
  { value: "Pacific/Auckland", label: "(GMT+12:00) Auckland", labelZh: "(GMT+12:00) 奥克兰" },
];

// Easing curves
export const easeOutExpo = [0.16, 1, 0.3, 1] as const;

// LocalStorage key for settings sidebar collapsed state
export const SETTINGS_SIDEBAR_COLLAPSED_KEY = "settings-sidebar-collapsed";

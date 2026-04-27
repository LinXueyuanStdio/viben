/**
 * Icon Picker Types
 *
 * Unified type definitions for the icon picker component system.
 */

/**
 * Icon type enumeration
 */
export type IconType = "lucide" | "emoji" | "image";

/**
 * Unified icon data format
 * Stored as JSON string in PageConfig.icon field
 */
export interface IconData {
  type: IconType;
  value: string;
}

/**
 * Lucide icon data
 * value: icon name in kebab-case, e.g., "file-text"
 */
export interface LucideIconData extends IconData {
  type: "lucide";
  value: string;
}

/**
 * Emoji icon data
 * value: Unicode emoji string, e.g., "🎉"
 */
export interface EmojiIconData extends IconData {
  type: "emoji";
  value: string;
}

/**
 * Image icon data
 * value: image path or URL
 * - Local upload: relative path to workspace, e.g., ".viben/icons/custom-icon.png"
 * - External URL: full URL, e.g., "https://example.com/icon.png"
 */
export interface ImageIconData extends IconData {
  type: "image";
  value: string;
}

/**
 * Icon size presets
 */
export type IconSize = "xs" | "sm" | "md" | "lg" | "xl";

/**
 * Icon category for organizing Lucide icons
 */
export interface IconCategory {
  id: string;
  labelKey: string;
  icons: string[];
}

/**
 * Virtual scroll row types for Lucide tab
 */
export type VirtualRow =
  | { type: "header"; categoryId: string; label: string }
  | { type: "icons"; names: string[] };

/**
 * Category group for organized icon display
 */
export interface CategoryGroup {
  id: string;
  labelKey: string;
  label: string;
  icons: string[];
}

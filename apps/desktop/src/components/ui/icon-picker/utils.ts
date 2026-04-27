/**
 * Icon Picker Utilities
 *
 * Helper functions for parsing, serializing, and validating icon data.
 */

import type { IconData } from "./types";
import { LUCIDE_ICON_MAP, DEFAULT_ICON_NAME, ICON_SIZE_MAP } from "./constants";

/**
 * Emoji detection regex
 * Matches common emoji patterns including:
 * - Basic emojis
 * - Emojis with skin tone modifiers
 * - Compound emojis with ZWJ
 * - Flag emojis
 */
const EMOJI_REGEX = /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*$/u;

/**
 * Check if a string is an emoji
 */
export function isEmoji(str: string): boolean {
  if (!str || str.length === 0) return false;

  // Quick check: if it's a known Lucide icon name, it's not an emoji
  if (LUCIDE_ICON_MAP[str.toLowerCase().replace(/_/g, "-")]) {
    return false;
  }

  // Check against emoji regex
  return EMOJI_REGEX.test(str);
}

/**
 * Check if a string looks like a file path or URL
 */
export function isImagePath(str: string): boolean {
  if (!str) return false;

  // Check for common image extensions
  const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico"];
  const lowerStr = str.toLowerCase();

  // Check URL patterns
  if (str.startsWith("http://") || str.startsWith("https://") || str.startsWith("data:image/")) {
    return true;
  }

  // Check file extensions
  return imageExtensions.some((ext) => lowerStr.endsWith(ext));
}

/**
 * Parse icon data from various formats
 *
 * Supports:
 * - New format: JSON string like '{"type":"lucide","value":"file-text"}'
 * - Old format: plain string like "file-text" (Lucide icon name)
 * - Emoji: single emoji character like "🎉"
 * - Image path: file path or URL
 */
export function parseIconData(icon?: string | null): IconData | null {
  if (!icon) return null;

  // Try parsing as JSON first (new format)
  try {
    const parsed = JSON.parse(icon);
    if (parsed && typeof parsed === "object" && "type" in parsed && "value" in parsed) {
      // Validate type
      if (["lucide", "emoji", "image"].includes(parsed.type)) {
        return parsed as IconData;
      }
    }
  } catch {
    // Not JSON, continue with other formats
  }

  // Check if it's an image path
  if (isImagePath(icon)) {
    return { type: "image", value: icon };
  }

  // Check if it's an emoji
  if (isEmoji(icon)) {
    return { type: "emoji", value: icon };
  }

  // Default: treat as Lucide icon name
  const normalizedName = icon.toLowerCase().replace(/_/g, "-");
  return { type: "lucide", value: normalizedName };
}

/**
 * Serialize icon data to JSON string for storage
 */
export function serializeIconData(data: IconData): string {
  return JSON.stringify(data);
}

/**
 * Create a Lucide icon data object
 */
export function createLucideIcon(name: string): IconData {
  return { type: "lucide", value: name.toLowerCase().replace(/_/g, "-") };
}

/**
 * Create an emoji icon data object
 */
export function createEmojiIcon(emoji: string): IconData {
  return { type: "emoji", value: emoji };
}

/**
 * Create an image icon data object
 */
export function createImageIcon(path: string): IconData {
  return { type: "image", value: path };
}

/**
 * Get the default icon data
 */
export function getDefaultIconData(): IconData {
  return { type: "lucide", value: DEFAULT_ICON_NAME };
}

/**
 * Check if two icon data objects are equal
 */
export function isIconEqual(a?: IconData | null, b?: IconData | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.type === b.type && a.value === b.value;
}

/**
 * Get pixel size from size preset or number
 */
export function getIconPixelSize(size: string | number): number {
  if (typeof size === "number") return size;
  return ICON_SIZE_MAP[size] ?? ICON_SIZE_MAP.md;
}

/**
 * Get Tailwind class for icon size
 */
export function getIconSizeClass(size: string | number): string {
  if (typeof size === "number") {
    return `h-[${size}px] w-[${size}px]`;
  }

  const sizeClasses: Record<string, string> = {
    xs: "h-3 w-3",
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
    xl: "h-6 w-6",
  };

  return sizeClasses[size] ?? sizeClasses.md;
}

/**
 * Generate a unique filename for uploaded icons
 */
export function generateIconFilename(extension = "png"): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `icon-${timestamp}-${random}.${extension}`;
}

/**
 * Get the icon storage directory path relative to workspace
 */
export function getIconStorageDir(): string {
  return ".viben/icons";
}

/**
 * Get the full icon path for storage
 */
export function getIconStoragePath(filename: string): string {
  return `${getIconStorageDir()}/${filename}`;
}

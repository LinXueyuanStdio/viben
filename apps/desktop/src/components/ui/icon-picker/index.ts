/**
 * Icon Picker Components
 *
 * Unified icon selection and display system supporting:
 * - Lucide icons (1500+ with async loading)
 * - Emoji (full set via emoji-mart)
 * - Custom images (upload or URL)
 */

// Main components
export { IconPicker, type IconPickerProps } from "./icon-picker";
export { IconDisplay, type IconDisplayProps } from "./icon-display";
export { DynamicLucideIcon } from "./dynamic-lucide-icon";

// Tab components (for advanced use cases)
export { LucideTab, type LucideTabProps } from "./tabs/lucide-tab";
export { EmojiTab, type EmojiTabProps } from "./tabs/emoji-tab";
export { ImageTab, type ImageTabProps } from "./tabs/image-tab";

// Hooks
export { useImageUpload, type UseImageUploadOptions, type UseImageUploadResult } from "./hooks/use-image-upload";
export { useLucideIcons, type UseLucideIconsReturn } from "./hooks/use-lucide-icons";

// Icon cache
export { ALL_ICON_NAMES, getCachedIcon, loadIcon, loadIcons } from "./icon-cache";

// Types
export type { IconData, IconType, IconSize, VirtualRow, CategoryGroup } from "./types";

// Utilities
export {
  parseIconData,
  serializeIconData,
  createLucideIcon,
  createEmojiIcon,
  createImageIcon,
  getDefaultIconData,
  isIconEqual,
  isEmoji,
  isImagePath,
  getIconPixelSize,
  getIconSizeClass,
  validateImageDimensions,
  generateIconFilename,
  getIconStorageDir,
  getIconStoragePath,
} from "./utils";

// Constants
export {
  LUCIDE_ICON_MAP,
  LUCIDE_CATEGORIES,
  CATEGORIZED_ICON_NAMES,
  ICON_SIZE_MAP,
  DEFAULT_ICON_NAME,
} from "./constants";

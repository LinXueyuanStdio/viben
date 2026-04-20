/**
 * Icon Picker Components
 *
 * Unified icon selection and display system supporting:
 * - Lucide icons (categorized)
 * - Emoji (categorized)
 * - Custom images (upload or URL)
 */

// Main components
export { IconPicker, type IconPickerProps } from "./icon-picker";
export { IconDisplay, type IconDisplayProps } from "./icon-display";

// Tab components (for advanced use cases)
export { LucideTab, type LucideTabProps } from "./tabs/lucide-tab";
export { EmojiTab, type EmojiTabProps } from "./tabs/emoji-tab";
export { ImageTab, type ImageTabProps } from "./tabs/image-tab";

// Hooks
export { useImageUpload, type UseImageUploadOptions, type UseImageUploadResult } from "./hooks/use-image-upload";

// Types
export type { IconData, IconType, IconSize } from "./types";

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
  ICON_CATEGORIES,
  ICON_SIZE_MAP,
  DEFAULT_ICON_NAME,
} from "./constants";

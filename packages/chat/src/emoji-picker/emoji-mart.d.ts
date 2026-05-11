declare module "@emoji-mart/react" {
  import type { ComponentType } from "react";

  export interface PickerProps {
    data?: unknown;
    onEmojiSelect?: (emoji: { native: string; id: string; shortcodes: string }) => void;
    theme?: "light" | "dark" | "auto";
    set?: "native" | "apple" | "google" | "twitter" | "facebook";
    locale?: string;
    perLine?: number;
    previewPosition?: "top" | "bottom" | "none";
    skinTonePosition?: "preview" | "search" | "none";
    maxFrequentRows?: number;
    navPosition?: "top" | "bottom" | "none";
    dynamicWidth?: boolean;
    emojiButtonSize?: number;
    emojiSize?: number;
    categories?: string[];
    autoFocus?: boolean;
  }

  const Picker: ComponentType<PickerProps>;
  export default Picker;
}

declare module "@emoji-mart/data" {
  const data: unknown;
  export default data;
}

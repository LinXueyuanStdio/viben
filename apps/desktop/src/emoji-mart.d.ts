declare module "@emoji-mart/react" {
  import type { ComponentType } from "react";
  interface PickerProps {
    data: unknown;
    onEmojiSelect: (emoji: {
      native: string;
      id: string;
      shortcodes: string;
      unified: string;
    }) => void;
    theme?: "light" | "dark" | "auto";
    set?: "native" | "apple" | "google" | "twitter" | "facebook";
    locale?: string;
    perLine?: number;
    previewPosition?: "none" | "top" | "bottom";
    skinTonePosition?: "none" | "search" | "preview";
    maxFrequentRows?: number;
    navPosition?: "top" | "bottom" | "none";
    dynamicWidth?: boolean;
    emojiButtonSize?: number;
    emojiSize?: number;
  }
  const Picker: ComponentType<PickerProps>;
  export default Picker;
}

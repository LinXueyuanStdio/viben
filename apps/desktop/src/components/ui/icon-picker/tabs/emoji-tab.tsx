/**
 * EmojiTab — emoji-mart integration
 *
 * Wraps @emoji-mart/react Picker with app theme and i18n support.
 */

import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/use-theme";
import "../emoji-mart.css";

export interface EmojiTabProps {
  onSelect: (emoji: string) => void;
}

interface EmojiMartEmoji {
  id: string;
  native: string;
  shortcodes: string;
  unified: string;
}

export function EmojiTab({ onSelect }: EmojiTabProps) {
  const { i18n } = useTranslation();
  const { resolvedTheme } = useTheme();

  const handleSelect = (emoji: EmojiMartEmoji) => {
    onSelect(emoji.native);
  };

  // Map i18n language to emoji-mart locale
  const locale = i18n.language?.startsWith("zh") ? "zh" : "en";

  return (
    <Picker
      data={data}
      onEmojiSelect={handleSelect}
      theme={resolvedTheme}
      set="native"
      locale={locale}
      perLine={9}
      previewPosition="none"
      skinTonePosition="search"
      maxFrequentRows={2}
      navPosition="bottom"
      dynamicWidth={false}
      emojiButtonSize={36}
      emojiSize={22}
    />
  );
}

export default EmojiTab;

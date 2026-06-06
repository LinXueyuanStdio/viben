import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import data from "@emoji-mart/data/sets/15/native.json";
import Picker from "@emoji-mart/react";
import { cn } from "@viben/ui";
import "./emoji-mart.css";

export interface EmojiPickerProps {
  /** Called when an emoji is selected */
  onSelect: (emoji: string) => void;
  /** Theme: "light", "dark", or "auto" (detects from DOM). Default: "auto" */
  theme?: "light" | "dark" | "auto";
  /** Locale for emoji names/search. Default: auto-detect from i18n */
  locale?: string;
  /** Additional CSS class for the wrapper */
  className?: string;
}

export function EmojiPicker({
  onSelect,
  theme = "auto",
  locale,
  className,
}: EmojiPickerProps) {
  const { i18n } = useTranslation();

  const resolvedTheme = useMemo(() => {
    if (theme !== "auto") return theme;
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark") ? "dark" : "light";
    }
    return "light";
  }, [theme]);

  const resolvedLocale = useMemo(() => {
    if (locale) return locale;
    const lang = i18n.language || "en";
    if (lang.startsWith("zh")) return "zh";
    if (lang.startsWith("ja")) return "ja";
    if (lang.startsWith("ko")) return "ko";
    if (lang.startsWith("fr")) return "fr";
    if (lang.startsWith("de")) return "de";
    if (lang.startsWith("es")) return "es";
    return "en";
  }, [locale, i18n.language]);

  const handleEmojiSelect = (emoji: { native: string }) => {
    onSelect(emoji.native);
  };

  return (
    <div className={cn("overflow-hidden rounded-lg", className)}>
      <Picker
        data={data}
        onEmojiSelect={handleEmojiSelect}
        theme={resolvedTheme}
        set="native"
        locale={resolvedLocale}
        perLine={9}
        previewPosition="none"
        skinTonePosition="search"
        maxFrequentRows={2}
        navPosition="bottom"
        dynamicWidth={false}
        emojiButtonSize={36}
        emojiSize={22}
      />
    </div>
  );
}

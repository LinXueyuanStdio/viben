import { cn } from "@viben/ui";

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

const COMMON_EMOJIS = [
  "😀", "😄", "🙂", "😊", "😍", "🥳", "😎", "🤔", "👍",
  "👏", "🙏", "💪", "🔥", "✨", "✅", "🚀", "💡", "🎯",
  "📌", "🧠", "👀", "💬", "🛠️", "📎", "📷", "❤️", "⭐",
];

export function EmojiPicker({
  onSelect,
  theme: _theme = "auto",
  locale: _locale,
  className,
}: EmojiPickerProps) {
  return (
    <div className={cn("grid w-[252px] grid-cols-9 gap-1 rounded-lg bg-popover p-1", className)}>
      {COMMON_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="flex size-7 items-center justify-center rounded-md text-lg leading-none transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onSelect(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

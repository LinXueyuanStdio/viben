import { Sun, Moon, Monitor } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { useCallback, useRef, KeyboardEvent } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeOption {
  value: Theme;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: "light", labelKey: "settings.light", icon: Sun },
  { value: "dark", labelKey: "settings.dark", icon: Moon },
  { value: "system", labelKey: "settings.system", icon: Monitor },
];

/**
 * ThemeSwitcher component for selecting Light/Dark/System theme.
 * Implements a radio group pattern with full accessibility support.
 */
export function ThemeSwitcher() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle keyboard navigation within the radio group
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const currentIndex = THEME_OPTIONS.findIndex((opt) => opt.value === theme);
      let newIndex = currentIndex;

      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault();
          newIndex = (currentIndex + 1) % THEME_OPTIONS.length;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          newIndex = (currentIndex - 1 + THEME_OPTIONS.length) % THEME_OPTIONS.length;
          break;
        default:
          return;
      }

      const newTheme = THEME_OPTIONS[newIndex].value;
      setTheme(newTheme);

      // Focus the new button
      const buttons = containerRef.current?.querySelectorAll("button");
      if (buttons && buttons[newIndex]) {
        (buttons[newIndex] as HTMLButtonElement).focus();
      }
    },
    [theme, setTheme]
  );

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={t("settings.theme")}
      className="flex gap-2"
    >
      {THEME_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isSelected = theme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => setTheme(option.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              // Base styles
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5",
              "rounded-lg text-sm font-medium",
              "min-h-[44px] min-w-[44px]", // Minimum touch target
              // Transition
              "transition-all duration-200",
              // Focus styles
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              // Selected state
              isSelected
                ? [
                    "bg-primary text-primary-foreground",
                    "shadow-md",
                  ]
                : [
                    "bg-muted/50 text-muted-foreground",
                    "hover:bg-muted hover:text-foreground",
                    "border border-transparent hover:border-border",
                  ]
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                "transition-transform duration-200",
                isSelected && "scale-110"
              )}
            />
            <span>{t(option.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}

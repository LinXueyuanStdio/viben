import React, { memo, useRef, useCallback, useEffect } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

/**
 * Props for the SearchBar component
 */
export interface SearchBarProps {
  /** Current search value */
  value: string;
  /** Callback when search value changes */
  onChange: (value: string) => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Whether the search is currently loading */
  loading?: boolean;
  /** Additional CSS class names */
  className?: string;
  /** Enable Cmd/Ctrl+K keyboard shortcut to focus */
  enableKeyboardShortcut?: boolean;
}

/**
 * A reusable search bar component with optional keyboard shortcut support.
 * Memoized to prevent unnecessary re-renders.
 *
 * @example
 * ```tsx
 * <SearchBar
 *   value={searchQuery}
 *   onChange={setSearchQuery}
 *   placeholder="Search..."
 *   loading={isSearching}
 *   enableKeyboardShortcut
 * />
 * ```
 */
export const SearchBar = memo(function SearchBar({
  value,
  onChange,
  placeholder,
  loading = false,
  className,
  enableKeyboardShortcut = false,
}: SearchBarProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear search
  const handleClear = useCallback(() => {
    onChange("");
    inputRef.current?.focus();
  }, [onChange]);

  // Handle input change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!enableKeyboardShortcut) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableKeyboardShortcut]);

  return (
    <div className={cn("relative", className)}>
      {/* Search Icon or Loading Spinner */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2">
        {loading ? (
          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
        ) : (
          <Search className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Input */}
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder || t("common.search")}
        className={cn("pl-10", value && "pr-10")}
      />

      {/* Clear Button */}
      {value && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">{t("common.clear")}</span>
        </Button>
      )}
    </div>
  );
});

export default SearchBar;

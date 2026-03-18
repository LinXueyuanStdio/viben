/**
 * Completion Input Component
 *
 * An input field with auto-completion dropdown support.
 * Shows completion suggestions as user types and allows
 * selection via click or keyboard navigation.
 */
import React, { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

export interface CompletionInputProps {
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Focus handler (triggers initial completions) */
  onFocus?: () => void;
  /** Completion suggestions */
  completions?: string[];
  /** Whether completions are loading */
  loading?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Input id for accessibility */
  id?: string;
  /** Additional class name */
  className?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Whether to show the dropdown indicator */
  showIndicator?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function CompletionInput({
  value,
  onChange,
  onFocus,
  completions = [],
  loading = false,
  placeholder,
  id,
  className,
  disabled,
  showIndicator = true,
}: CompletionInputProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter completions based on current value
  const filteredCompletions = completions.filter((item) =>
    item.toLowerCase().includes(value.toLowerCase())
  );

  // Show dropdown when there are completions and input is focused
  const shouldShowDropdown = isOpen && (filteredCompletions.length > 0 || loading);

  // Handle input change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      setHighlightedIndex(-1);
    },
    [onChange]
  );

  // Handle input focus
  const handleFocus = useCallback(() => {
    setIsOpen(true);
    onFocus?.();
  }, [onFocus]);

  // Handle input blur
  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Don't close if clicking on dropdown
    if (dropdownRef.current?.contains(e.relatedTarget as Node)) {
      return;
    }
    // Delay closing to allow click events to fire
    setTimeout(() => setIsOpen(false), 150);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!shouldShowDropdown) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filteredCompletions.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCompletions.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < filteredCompletions.length) {
            onChange(filteredCompletions[highlightedIndex]);
            setIsOpen(false);
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          break;
        case "Tab":
          if (highlightedIndex >= 0 && highlightedIndex < filteredCompletions.length) {
            e.preventDefault();
            onChange(filteredCompletions[highlightedIndex]);
            setIsOpen(false);
          }
          break;
      }
    },
    [shouldShowDropdown, filteredCompletions, highlightedIndex, onChange]
  );

  // Handle completion selection
  const handleSelect = useCallback(
    (completion: string) => {
      onChange(completion);
      setIsOpen(false);
      inputRef.current?.focus();
    },
    [onChange]
  );

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const item = dropdownRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  // Reset highlight when completions change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [completions]);

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn("pr-8", className)}
          autoComplete="off"
        />
        {showIndicator && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            {!loading && filteredCompletions.length > 0 && (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
        )}
      </div>

      {/* Dropdown */}
      {shouldShowDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 py-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-auto"
          role="listbox"
          tabIndex={-1}
        >
          {loading && filteredCompletions.length === 0 ? (
            <div className="flex items-center justify-center py-2 px-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
              {t("inspector.loadingSuggestions")}
            </div>
          ) : (
            filteredCompletions.map((completion, index) => (
              <div
                key={completion}
                role="option"
                aria-selected={index === highlightedIndex}
                className={cn(
                  "px-3 py-1.5 text-sm cursor-pointer transition-colors",
                  index === highlightedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted"
                )}
                onClick={() => handleSelect(completion)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {completion}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default CompletionInput;

import * as React from "react";
import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  loading?: boolean;
}

/**
 * SearchBar component for marketplace search
 * Memoized to prevent unnecessary re-renders
 */
export const SearchBar = React.memo(function SearchBar({
  value,
  onChange,
  placeholder,
  className,
  loading = false,
}: SearchBarProps) {
  const { t } = useTranslation();
  const defaultPlaceholder = placeholder ?? t("marketplace.searchPlaceholder");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleClear = React.useCallback(() => {
    onChange("");
    inputRef.current?.focus();
  }, [onChange]);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  return (
    <div className={cn("relative", className)}>
      <Search
        className={cn(
          "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground",
          loading && "animate-pulse"
        )}
      />
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={defaultPlaceholder}
        className="pl-10 pr-10"
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
          onClick={handleClear}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">{t("common.clearSearch")}</span>
        </Button>
      )}
    </div>
  );
});

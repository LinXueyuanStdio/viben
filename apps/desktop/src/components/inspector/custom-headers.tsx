import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Eye, EyeOff, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

// =============================================================================
// Type Definitions
// =============================================================================

export interface CustomHeader {
  name: string;
  value: string;
  enabled: boolean;
}

export type CustomHeadersType = CustomHeader[];

/**
 * Create an empty header entry
 */
export const createEmptyHeader = (): CustomHeader => ({
  name: "",
  value: "",
  enabled: true,
});

/**
 * Create a header from a Bearer token
 */
export const createHeaderFromBearerToken = (
  bearerToken: string,
  headerName?: string
): CustomHeader => ({
  name: headerName || "Authorization",
  value:
    headerName?.toLowerCase() === "authorization" || !headerName
      ? `Bearer ${bearerToken}`
      : bearerToken,
  enabled: true,
});

/**
 * Get only enabled headers with non-empty name and value
 */
export const getEnabledHeaders = (headers: CustomHeadersType): CustomHeadersType => {
  return headers.filter(
    (header) => header.enabled && header.name.trim() && header.value.trim()
  );
};

/**
 * Convert custom headers array to a Record<string, string>
 */
export const headersToRecord = (
  headers: CustomHeadersType
): Record<string, string> => {
  const enabledHeaders = getEnabledHeaders(headers);
  const record: Record<string, string> = {};

  enabledHeaders.forEach((header) => {
    record[header.name.trim()] = header.value.trim();
  });

  return record;
};

/**
 * Convert Record<string, string> to custom headers array
 */
export const recordToHeaders = (
  record: Record<string, string>
): CustomHeadersType => {
  return Object.entries(record).map(([name, value]) => ({
    name,
    value,
    enabled: true,
  }));
};

/**
 * Migration helper for backward compatibility
 */
export const migrateFromLegacyAuth = (
  bearerToken?: string,
  headerName?: string
): CustomHeadersType => {
  return bearerToken
    ? [createHeaderFromBearerToken(bearerToken, headerName)]
    : [];
};

// =============================================================================
// Component
// =============================================================================

interface CustomHeadersProps {
  /** Array of custom headers */
  headers: CustomHeadersType;
  /** Callback when headers change */
  onChange: (headers: CustomHeadersType) => void;
  /** Whether the editor is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Show a compact version */
  compact?: boolean;
}

export function CustomHeaders({
  headers,
  onChange,
  disabled = false,
  className,
  compact = false,
}: CustomHeadersProps) {
  const { t } = useTranslation();
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [jsonValue, setJsonValue] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [visibleValues, setVisibleValues] = useState<Set<number>>(new Set());

  const updateHeader = useCallback(
    (index: number, field: keyof CustomHeader, value: string | boolean) => {
      const newHeaders = [...headers];
      newHeaders[index] = { ...newHeaders[index], [field]: value };
      onChange(newHeaders);
    },
    [headers, onChange]
  );

  const addHeader = useCallback(() => {
    onChange([...headers, createEmptyHeader()]);
  }, [headers, onChange]);

  const removeHeader = useCallback(
    (index: number) => {
      const newHeaders = headers.filter((_, i) => i !== index);
      onChange(newHeaders);
    },
    [headers, onChange]
  );

  const toggleValueVisibility = useCallback((index: number) => {
    setVisibleValues((prev) => {
      const newVisible = new Set(prev);
      if (newVisible.has(index)) {
        newVisible.delete(index);
      } else {
        newVisible.add(index);
      }
      return newVisible;
    });
  }, []);

  const switchToJsonMode = useCallback(() => {
    const jsonObject: Record<string, string> = {};
    headers.forEach((header) => {
      if (header.enabled && header.name.trim() && header.value.trim()) {
        jsonObject[header.name.trim()] = header.value.trim();
      }
    });
    setJsonValue(JSON.stringify(jsonObject, null, 2));
    setJsonError(null);
    setIsJsonMode(true);
  }, [headers]);

  const switchToFormMode = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonValue);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        setJsonError(
          t(
            "inspector.customHeaders.jsonMustBeObject",
            "JSON must be an object with string key-value pairs"
          )
        );
        return;
      }

      const newHeaders: CustomHeadersType = Object.entries(parsed).map(
        ([name, value]) => ({
          name,
          value: String(value),
          enabled: true,
        })
      );

      onChange(newHeaders);
      setJsonError(null);
      setIsJsonMode(false);
    } catch {
      setJsonError(t("inspector.customHeaders.invalidJson", "Invalid JSON format"));
    }
  }, [jsonValue, onChange, t]);

  const handleJsonChange = useCallback((value: string) => {
    setJsonValue(value);
    setJsonError(null);
  }, []);

  // JSON Mode View
  if (isJsonMode) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex justify-between items-center gap-2">
          <Label className="text-xs font-medium">
            {t("inspector.customHeaders.titleJson", "Custom Headers (JSON)")}
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={switchToFormMode}
            className="h-7 text-xs"
            disabled={disabled}
          >
            {t("inspector.customHeaders.switchToForm", "Switch to Form")}
          </Button>
        </div>
        <div className="space-y-2">
          <Textarea
            value={jsonValue}
            onChange={(e) => handleJsonChange(e.target.value)}
            placeholder='{\n  "Authorization": "Bearer token123",\n  "X-Custom-Header": "value"\n}'
            className="font-mono text-xs min-h-[100px] resize-none"
            disabled={disabled}
          />
          {jsonError && (
            <p className="text-xs text-red-600 dark:text-red-400">{jsonError}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {t(
              "inspector.customHeaders.jsonHint",
              "Enter headers as a JSON object with string key-value pairs."
            )}
          </p>
        </div>
      </div>
    );
  }

  // Form Mode View
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex justify-between items-center gap-2">
        <Label className="text-xs font-medium">
          {t("inspector.customHeaders.title", "Custom Headers")}
        </Label>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={switchToJsonMode}
            className="h-7 text-xs px-2"
            disabled={disabled}
            title={t("inspector.customHeaders.switchToJson", "Switch to JSON mode")}
          >
            <Code2 className="w-3 h-3 mr-1" />
            {t("inspector.json", "JSON")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addHeader}
            className="h-7 text-xs px-2"
            disabled={disabled}
          >
            <Plus className="w-3 h-3 mr-1" />
            {t("common.add", "Add")}
          </Button>
        </div>
      </div>

      {headers.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground border border-dashed rounded-lg">
          <p className="text-sm">
            {t("inspector.customHeaders.noHeaders", "No custom headers configured")}
          </p>
          <p className="text-xs mt-1">
            {t("inspector.customHeaders.addHint", 'Click "Add" to get started')}
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {headers.map((header, index) => (
            <div
              key={index}
              className={cn(
                "flex items-start gap-2 p-2 border rounded-lg",
                "bg-muted/20 transition-colors",
                !header.enabled && "opacity-60"
              )}
            >
              {/* Enable/Disable Toggle */}
              <Switch
                checked={header.enabled}
                onCheckedChange={(enabled) =>
                  updateHeader(index, "enabled", enabled)
                }
                className="shrink-0 mt-2"
                disabled={disabled}
              />

              {/* Name and Value Inputs */}
              <div className={cn("flex-1 min-w-0", compact ? "space-y-1" : "space-y-2")}>
                <Input
                  placeholder={t(
                    "inspector.customHeaders.namePlaceholder",
                    "Header Name"
                  )}
                  value={header.name}
                  onChange={(e) => updateHeader(index, "name", e.target.value)}
                  className={cn("font-mono", compact ? "h-7 text-xs" : "text-sm")}
                  disabled={disabled}
                />
                <div className="relative">
                  <Input
                    placeholder={t(
                      "inspector.customHeaders.valuePlaceholder",
                      "Header Value"
                    )}
                    value={header.value}
                    onChange={(e) => updateHeader(index, "value", e.target.value)}
                    type={visibleValues.has(index) ? "text" : "password"}
                    className={cn("font-mono pr-8", compact ? "h-7 text-xs" : "text-sm")}
                    disabled={disabled}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleValueVisibility(index)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                    disabled={disabled}
                  >
                    {visibleValues.has(index) ? (
                      <EyeOff className="w-3 h-3" />
                    ) : (
                      <Eye className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Delete Button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeHeader(index)}
                className="shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 h-6 w-6 p-0 mt-2"
                disabled={disabled}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {headers.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t(
            "inspector.customHeaders.hint",
            "Use the toggle to enable/disable headers. Only enabled headers with both name and value will be sent."
          )}
        </p>
      )}
    </div>
  );
}

export default CustomHeaders;

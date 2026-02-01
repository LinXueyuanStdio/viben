import { useState, useMemo } from "react";
import {
  Check,
  X,
  ExternalLink,
  Key,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
  Globe,
  Lock,
  Building2,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/stores";
import { useApiKeys } from "@/hooks/use-api-keys";
import { useMarketplace, type FlatSource, type ProviderInfo } from "@/hooks/use-marketplace";

// Provider category icons
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  academic: <BookOpen className="h-5 w-5 text-blue-600" />,
  publisher: <Key className="h-5 w-5 text-amber-600" />,
  institutional: <Building2 className="h-5 w-5 text-purple-600" />,
  web: <Globe className="h-5 w-5 text-green-600" />,
  other: <Package className="h-5 w-5 text-gray-600" />,
};

// Category display names
const CATEGORY_NAMES: Record<string, string> = {
  academic: "Academic Sources",
  publisher: "Publisher Sources",
  institutional: "Institutional Sources",
  web: "Web Sources",
  other: "Other Sources",
};

// Category descriptions
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  academic: "Open access academic databases and pre-print servers",
  publisher: "Commercial publishers - API key required",
  institutional: "Requires institutional subscription",
  web: "Web-based search engines",
  other: "Other data sources",
};

export function ProvidersPage() {
  const { setProviderApiKey } = useAppStore();
  const {
    sourcesByProvider,
    loading,
    error,
    refresh,
    index,
  } = useMarketplace();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(
    new Set(["academic", "publisher"])
  );

  // Filter sources based on search query
  const filteredSourcesByProvider = useMemo(() => {
    if (!searchQuery.trim()) return sourcesByProvider;

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, FlatSource[]> = {};

    for (const [providerId, sources] of Object.entries(sourcesByProvider)) {
      const matchingSources = sources.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          s.source_name.toLowerCase().includes(query)
      );
      if (matchingSources.length > 0) {
        filtered[providerId] = matchingSources;
      }
    }

    return filtered;
  }, [sourcesByProvider, searchQuery]);

  // Count total sources
  const totalSources = Object.values(sourcesByProvider).reduce(
    (acc, sources) => acc + sources.length,
    0
  );

  const toggleProvider = (providerId: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(providerId)) {
        next.delete(providerId);
      } else {
        next.add(providerId);
      }
      return next;
    });
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Data Sources</h1>
          <p className="text-sm text-muted-foreground">
            {totalSources} sources available across{" "}
            {Object.keys(sourcesByProvider).length} providers
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refresh(true)}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search sources..."
          className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background text-sm"
        />
      </div>

      {/* Info banner */}
      <p className="text-sm text-muted-foreground mb-4 p-3 rounded-lg bg-muted/50">
        Configure API keys for sources that require them. Sources use hierarchical
        naming ({" "}
        <code className="bg-muted px-1 rounded text-xs">provider/source</code>)
        for organization.
      </p>

      {/* Provider list */}
      <ScrollArea className="flex-1">
        <div className="space-y-4">
          {Object.entries(filteredSourcesByProvider).map(
            ([providerId, sources]) => {
              const providerInfo = index?.providers[providerId];
              const isExpanded = expandedProviders.has(providerId);

              return (
                <ProviderSection
                  key={providerId}
                  providerId={providerId}
                  providerInfo={providerInfo}
                  sources={sources}
                  isExpanded={isExpanded}
                  onToggle={() => toggleProvider(providerId)}
                  onApiKeyChange={setProviderApiKey}
                />
              );
            }
          )}

          {Object.keys(filteredSourcesByProvider).length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery
                ? "No sources match your search"
                : "No sources available"}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface ProviderSectionProps {
  providerId: string;
  providerInfo?: ProviderInfo;
  sources: FlatSource[];
  isExpanded: boolean;
  onToggle: () => void;
  onApiKeyChange: (id: string, hasKey: boolean) => void;
}

function ProviderSection({
  providerId,
  providerInfo,
  sources,
  isExpanded,
  onToggle,
  onApiKeyChange,
}: ProviderSectionProps) {
  const icon = CATEGORY_ICONS[providerId] || CATEGORY_ICONS.other;
  const name = providerInfo?.name || CATEGORY_NAMES[providerId] || providerId;
  const description =
    providerInfo?.description || CATEGORY_DESCRIPTIONS[providerId] || "";

  // Count sources by API key type
  const freeCount = sources.filter((s) => s.api_key_type === "none").length;
  const optionalCount = sources.filter(
    (s) => s.api_key_type === "optional"
  ).length;
  const requiredCount = sources.filter(
    (s) => s.api_key_type === "required"
  ).length;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Provider header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex-shrink-0">{icon}</div>
        <div className="flex-1 text-left">
          <h3 className="font-semibold">{name}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {freeCount > 0 && (
            <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">
              {freeCount} free
            </span>
          )}
          {optionalCount > 0 && (
            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded">
              {optionalCount} optional
            </span>
          )}
          {requiredCount > 0 && (
            <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded">
              {requiredCount} required
            </span>
          )}
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
      </button>

      {/* Sources */}
      {isExpanded && (
        <div className="border-t">
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {sources.map((source) => (
              <SourceCard
                key={source.id}
                source={source}
                onApiKeyChange={onApiKeyChange}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface SourceCardProps {
  source: FlatSource;
  onApiKeyChange: (id: string, hasKey: boolean) => void;
}

function SourceCard({ source, onApiKeyChange }: SourceCardProps) {
  const { setApiKey, deleteApiKey, providers } = useApiKeys();
  const [editing, setEditing] = useState(false);
  const [keyValue, setKeyValue] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  // Find provider info from useApiKeys (using flat name)
  const apiKeyInfo = providers.find(
    (p) => p.provider_id === source.source_name
  );
  const hasApiKey = apiKeyInfo?.has_key ?? false;

  const handleSaveKey = async () => {
    if (!keyValue.trim()) return;

    setSaving(true);
    const success = await setApiKey(source.source_name, keyValue);
    if (success) {
      onApiKeyChange(source.source_name, true);
      setEditing(false);
      setKeyValue("");
    }
    setSaving(false);
  };

  const handleDeleteKey = async () => {
    if (!confirm(`Remove API key for ${source.name}?`)) return;

    await deleteApiKey(source.source_name);
    onApiKeyChange(source.source_name, false);
  };

  const handleCancel = () => {
    setEditing(false);
    setKeyValue("");
  };

  const requiresKey = source.api_key_type === "required";
  const optionalKey = source.api_key_type === "optional";
  const isAvailable = !requiresKey || hasApiKey;
  const showApiKeyConfig = requiresKey || optionalKey;

  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${
              isAvailable
                ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                : "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
            }`}
          >
            {isAvailable ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{source.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {source.description}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
              {source.id}
            </p>
            {showApiKeyConfig && (
              <p className="text-xs mt-1">
                {hasApiKey ? (
                  <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                    <Key className="h-3 w-3" />
                    API key configured
                    {apiKeyInfo?.key_prefix && (
                      <code className="ml-1 bg-muted px-1 rounded text-[10px]">
                        {apiKeyInfo.key_prefix}
                      </code>
                    )}
                  </span>
                ) : requiresKey ? (
                  <span className="text-amber-600 dark:text-amber-400">
                    API key required
                  </span>
                ) : (
                  <span className="text-blue-600 dark:text-blue-400">
                    API key optional
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {source.documentation && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(source.documentation, "_blank")}
              title="Documentation"
              className="h-7 w-7 p-0"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
          {showApiKeyConfig && (
            <>
              {!editing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(true)}
                  className="h-7 text-xs"
                >
                  <Key className="h-3 w-3 mr-1" />
                  {hasApiKey ? "Update" : "Add"}
                </Button>
              )}
              {hasApiKey && !editing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteKey}
                  className="text-destructive hover:text-destructive h-7 w-7 p-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* API Key Input */}
      {editing && (
        <div className="mt-3 pt-3 border-t">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? "text" : "password"}
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                placeholder={`Enter ${source.name} API key...`}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-xs font-mono pr-8"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveKey();
                  if (e.key === "Escape") handleCancel();
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <Button
              size="sm"
              onClick={handleSaveKey}
              disabled={saving || !keyValue.trim()}
              className="h-7"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="h-7"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          {source.documentation && (
            <p className="text-[10px] text-muted-foreground mt-2">
              Get your API key from{" "}
              <a
                href={source.documentation}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {source.name} Developer Portal
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Search,
  RefreshCw,
  Package,
  ChevronRight,
  Database,
  Layers,
  GraduationCap,
  BookOpen,
  Building,
  Users,
  FileText,
  CheckCircle,
  User,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAppStore } from "@/stores";
import { useApiKeys } from "@/hooks/use-api-keys";
import {
  useMarketplace,
  type FlatSource,
  type MarketplacePlugin,
  type MarketplaceCategory,
} from "@/hooks/use-marketplace";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

// Check if user prefers reduced motion
const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Easing curves
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

// Stagger animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: prefersReducedMotion ? 0 : 0.08,
      delayChildren: prefersReducedMotion ? 0 : 0.1,
    },
  },
};

const itemVariants = {
  hidden: {
    opacity: 0,
    y: prefersReducedMotion ? 0 : 12,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: prefersReducedMotion ? 0 : 0.4,
      ease: easeOutExpo,
    },
  },
};

// Tab content transition variants
const tabContentVariants = {
  initial: {
    opacity: 0,
    x: prefersReducedMotion ? 0 : 20,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: prefersReducedMotion ? 0 : 0.3,
      ease: easeOutExpo,
    },
  },
  exit: {
    opacity: 0,
    x: prefersReducedMotion ? 0 : -20,
    transition: {
      duration: prefersReducedMotion ? 0 : 0.2,
    },
  },
};

type TabValue = "builtin" | "marketplace";

// Icon mapping for categories
const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  academic: GraduationCap,
  publisher: BookOpen,
  institutional: Building,
  web: Globe,
  social: Users,
  docs: FileText,
};

function getCategoryIcon(iconName?: string) {
  if (!iconName) return Package;
  // Map icon names to components
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    "graduation-cap": GraduationCap,
    "book-open": BookOpen,
    building: Building,
    globe: Globe,
    users: Users,
    "file-text": FileText,
  };
  return iconMap[iconName] || categoryIcons[iconName] || Package;
}

export function ProvidersPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabValue>("builtin");
  const [searchQuery, setSearchQuery] = useState("");

  const {
    sources,
    plugins,
    categories,
    loading: marketplaceLoading,
    error: marketplaceError,
    refresh: refreshMarketplace,
  } = useMarketplace();

  const loading = marketplaceLoading;
  const error = marketplaceError;

  // Filter sources based on search query
  const filteredSources = useMemo(() => {
    if (!searchQuery.trim()) return sources;

    const query = searchQuery.toLowerCase();
    return sources.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.source_name.toLowerCase().includes(query) ||
        s.plugin_name.toLowerCase().includes(query)
    );
  }, [sources, searchQuery]);

  // Count sources by API key type
  const sourceCounts = useMemo(() => {
    const counts = { none: 0, optional: 0, required: 0 };
    sources.forEach((s) => {
      counts[s.api_key_type]++;
    });
    return counts;
  }, [sources]);

  const handleRefresh = async () => {
    await refreshMarketplace(true);
  };

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-serif">{t("providers.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("providers.sourcesAvailable", {
              count: sources.length,
              total: sources.length,
            })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {t("common.refresh")}
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList className="mb-4">
          <TabsTrigger value="builtin">
            <Database className="h-4 w-4 mr-2" />
            {t("providers.builtinSources", { defaultValue: "Built-in Sources" })}
          </TabsTrigger>
          <TabsTrigger value="marketplace">
            <Package className="h-4 w-4 mr-2" />
            {t("providers.marketplace", { defaultValue: "Marketplace" })}
          </TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          <TabsContent value="builtin" className="flex-1 min-h-0">
            <motion.div
              key="builtin"
              variants={tabContentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="h-full flex flex-col"
            >
              <BuiltinSourcesTab
                sources={filteredSources}
                sourceCounts={sourceCounts}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                loading={loading}
              />
            </motion.div>
          </TabsContent>

          <TabsContent value="marketplace" className="flex-1 min-h-0">
            <motion.div
              key="marketplace"
              variants={tabContentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="h-full flex flex-col"
            >
              <MarketplaceTab
                plugins={plugins}
                categories={categories}
                loading={loading}
              />
            </motion.div>
          </TabsContent>
        </AnimatePresence>
      </Tabs>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Built-in Sources Tab
 * -------------------------------------------------------------------------- */

interface BuiltinSourcesTabProps {
  sources: FlatSource[];
  sourceCounts: { none: number; optional: number; required: number };
  searchQuery: string;
  onSearchChange: (query: string) => void;
  loading: boolean;
}

function BuiltinSourcesTab({
  sources,
  sourceCounts,
  searchQuery,
  onSearchChange,
  loading,
}: BuiltinSourcesTabProps) {
  const { t } = useTranslation();
  const { setProviderApiKey } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {/* Search and Stats */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("providers.searchSources")}
            className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded">
            {sourceCounts.none} {t("providers.free")}
          </span>
          <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-1 rounded">
            {sourceCounts.optional} {t("providers.optional")}
          </span>
          <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded">
            {sourceCounts.required} {t("providers.required")}
          </span>
        </div>
      </div>

      {/* Info Banner */}
      <div className="mb-4 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
        {t("providers.configureInfo")}
      </div>

      {/* Sources Grid */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SourceCardSkeleton key={i} />
            ))}
          </div>
        ) : sources.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {searchQuery
              ? t("providers.noSourcesMatch")
              : t("providers.noSourcesAvailable")}
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate={mounted ? "visible" : "hidden"}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pb-4"
          >
            {sources.map((source) => (
              <motion.div key={source.id} variants={itemVariants}>
                <SourceCard
                  source={source}
                  onApiKeyChange={setProviderApiKey}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </ScrollArea>
    </>
  );
}

/* -----------------------------------------------------------------------------
 * Source Card Component
 * -------------------------------------------------------------------------- */

interface SourceCardProps {
  source: FlatSource;
  onApiKeyChange: (id: string, hasKey: boolean) => void;
}

function SourceCard({ source, onApiKeyChange }: SourceCardProps) {
  const { t } = useTranslation();
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
    if (!confirm(t("providers.removeApiKey", { name: source.name }))) return;

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

  // Get API key status badge
  const getStatusBadge = () => {
    if (source.api_key_type === "none") {
      return (
        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">
          {t("providers.free")}
        </span>
      );
    }
    if (source.api_key_type === "optional") {
      return (
        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded">
          {t("providers.optional")}
        </span>
      );
    }
    return (
      <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded">
        {t("providers.required")}
      </span>
    );
  };

  return (
    <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 theme-transition">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
              isAvailable
                ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                : "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
            )}
          >
            {isAvailable ? (
              <Check className="h-5 w-5" />
            ) : (
              <Lock className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">{source.name}</h3>
              {getStatusBadge()}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {source.description}
            </p>
          </div>
        </div>
      </div>

      {/* Plugin info */}
      <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
        <Layers className="h-3 w-3" />
        <span className="font-mono">{source.id}</span>
      </div>

      {/* API Key Status */}
      {showApiKeyConfig && (
        <div className="mb-3">
          {hasApiKey ? (
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
              <Key className="h-3 w-3" />
              <span>{t("providers.apiKeyConfigured")}</span>
              {apiKeyInfo?.key_prefix && (
                <code className="bg-muted px-1 rounded text-[10px]">
                  {apiKeyInfo.key_prefix}
                </code>
              )}
            </div>
          ) : requiresKey ? (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <Key className="h-3 w-3" />
              <span>{t("providers.apiKeyRequired")}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
              <Key className="h-3 w-3" />
              <span>{t("providers.apiKeyOptional")}</span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {source.documentation && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(source.documentation, "_blank")}
            title={t("providers.documentation")}
            className="h-8 px-2"
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            <span className="text-xs">{t("providers.documentation")}</span>
          </Button>
        )}
        <div className="flex-1" />
        {showApiKeyConfig && (
          <>
            {!editing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
                className="h-8 text-xs"
              >
                <Key className="h-3 w-3 mr-1" />
                {hasApiKey ? t("common.update") : t("common.add")}
              </Button>
            )}
            {hasApiKey && !editing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteKey}
                className="text-destructive hover:text-destructive h-8 w-8 p-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </>
        )}
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
                placeholder={t("providers.enterApiKey", { name: source.name })}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-xs font-mono pr-8 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveKey();
                  if (e.key === "Escape") handleCancel();
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
              {t("providers.getApiKeyFrom")}{" "}
              <a
                href={source.documentation}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {t("providers.developerPortal", { name: source.name })}
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Source Card Skeleton
 * -------------------------------------------------------------------------- */

function SourceCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-3 w-full bg-muted rounded" />
        </div>
      </div>
      <div className="h-3 w-32 bg-muted rounded mb-3" />
      <div className="flex gap-2">
        <div className="h-8 w-20 bg-muted rounded" />
        <div className="flex-1" />
        <div className="h-8 w-16 bg-muted rounded" />
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Marketplace Tab (Plugin-centric)
 * -------------------------------------------------------------------------- */

interface MarketplaceTabProps {
  plugins: MarketplacePlugin[];
  categories: MarketplaceCategory[];
  loading: boolean;
}

function MarketplaceTab({
  plugins,
  categories,
  loading,
}: MarketplaceTabProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [expandedPlugin, setExpandedPlugin] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter plugins based on search query
  const filteredPlugins = useMemo(() => {
    if (!searchQuery.trim()) return plugins;
    const query = searchQuery.toLowerCase();
    return plugins.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query) ||
        p.author_name.toLowerCase().includes(query)
    );
  }, [plugins, searchQuery]);

  // Calculate total sources
  const totalSources = useMemo(
    () => plugins.reduce((acc, p) => acc + p.source_count, 0),
    [plugins]
  );

  return (
    <>
      {/* Search */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("providers.searchPlugins", { defaultValue: "Search plugins..." })}
            className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4 p-3 rounded-lg bg-muted/50">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span>
              {t("providers.pluginsAvailable", {
                defaultValue: "{{count}} plugins available",
                count: plugins.length,
              })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <span>
              {t("providers.totalSourcesAvailable", {
                defaultValue: "{{count}} sources available",
                count: totalSources,
              })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span>
              {t("providers.categoriesAvailable", {
                defaultValue: "{{count}} categories",
                count: categories.length,
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Category Pills */}
      {categories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {categories.map((category) => {
            const IconComponent = getCategoryIcon(category.icon);
            return (
              <div
                key={category.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 text-xs"
              >
                <IconComponent className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{category.name}</span>
                <span className="text-muted-foreground">
                  ({category.source_count})
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Plugins Grid */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <PluginCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredPlugins.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">
              {searchQuery
                ? t("providers.noPluginsMatch", {
                    defaultValue: "No plugins match your search",
                  })
                : t("providers.noPluginsAvailable", {
                    defaultValue: "No plugins available",
                  })}
            </p>
            <p className="text-sm mt-1">
              {t("providers.checkBackLater", {
                defaultValue: "Check back later for new plugins",
              })}
            </p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate={mounted ? "visible" : "hidden"}
            className="grid gap-4 sm:grid-cols-2 pb-4"
          >
            {filteredPlugins.map((plugin) => (
              <motion.div key={plugin.id} variants={itemVariants}>
                <PluginCard
                  plugin={plugin}
                  categories={categories}
                  expanded={expandedPlugin === plugin.id}
                  onToggle={() =>
                    setExpandedPlugin(
                      expandedPlugin === plugin.id ? null : plugin.id
                    )
                  }
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </ScrollArea>
    </>
  );
}

/* -----------------------------------------------------------------------------
 * Plugin Card Component (v2 Schema)
 * -------------------------------------------------------------------------- */

interface PluginCardProps {
  plugin: MarketplacePlugin;
  categories: MarketplaceCategory[];
  expanded: boolean;
  onToggle: () => void;
}

function PluginCard({
  plugin,
  categories,
  expanded,
  onToggle,
}: PluginCardProps) {
  const { t } = useTranslation();

  // Get category names for this plugin
  const pluginCategories = useMemo(() => {
    return plugin.categories
      .map((catId) => categories.find((c) => c.id === catId))
      .filter(Boolean) as MarketplaceCategory[];
  }, [plugin.categories, categories]);

  return (
    <div className="rounded-xl border bg-card overflow-hidden transition-all duration-300 hover:border-primary/30 hover:shadow-lg theme-transition">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              plugin.builtin
                ? "bg-primary/10 text-primary"
                : "bg-secondary/50 text-secondary-foreground"
            )}
          >
            <Package className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{plugin.name}</h3>
              {plugin.builtin && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                  {t("providers.builtin", { defaultValue: "Built-in" })}
                </span>
              )}
              {plugin.version && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                  v{plugin.version}
                </span>
              )}
              <span className="text-xs bg-muted px-2 py-0.5 rounded">
                {plugin.source_count} {t("searchService.sources")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {plugin.description}
            </p>
          </div>
          <ChevronRight
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform duration-200 flex-shrink-0",
              expanded && "rotate-90"
            )}
          />
        </div>

        {/* Author and License */}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <User className="h-3 w-3" />
            <span>{plugin.author_name}</span>
          </div>
          {plugin.license && (
            <div className="flex items-center gap-1.5">
              <Tag className="h-3 w-3" />
              <span>{plugin.license}</span>
            </div>
          )}
        </div>

        {/* Category badges */}
        {pluginCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {pluginCategories.map((cat) => {
              const IconComponent = getCategoryIcon(cat.icon);
              return (
                <span
                  key={cat.id}
                  className="flex items-center gap-1 text-xs bg-muted/50 px-2 py-0.5 rounded"
                >
                  <IconComponent className="h-3 w-3" />
                  {cat.name}
                </span>
              );
            })}
          </div>
        )}
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t p-4 bg-muted/20">
              {/* Links */}
              <div className="flex flex-wrap gap-2 mb-4">
                {plugin.homepage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(plugin.homepage, "_blank")}
                    className="h-7 text-xs"
                  >
                    <Globe className="h-3 w-3 mr-1" />
                    {t("providers.homepage", { defaultValue: "Homepage" })}
                  </Button>
                )}
                {plugin.repository && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(plugin.repository, "_blank")}
                    className="h-7 text-xs"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    {t("providers.repository", { defaultValue: "Repository" })}
                  </Button>
                )}
              </div>

              {/* Sources List */}
              <h4 className="text-sm font-medium mb-3">
                {t("providers.includedSources", {
                  defaultValue: "Included Sources",
                })}
              </h4>
              <div className="space-y-2">
                {plugin.sources.length > 0 ? (
                  plugin.sources.map((sourceName) => (
                    <div
                      key={sourceName}
                      className="flex items-center gap-2 text-sm"
                    >
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      <span className="font-mono text-xs">{sourceName}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("providers.noSourcesInPlugin", {
                      defaultValue: "No sources in this plugin",
                    })}
                  </p>
                )}
              </div>

              {/* Package info for non-builtin */}
              {!plugin.builtin && plugin.package && (
                <div className="mt-4 pt-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    {t("providers.installWith", { defaultValue: "Install with:" })}
                  </p>
                  <code className="block mt-1 text-xs bg-muted p-2 rounded font-mono">
                    pip install {plugin.package}
                  </code>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Plugin Card Skeleton
 * -------------------------------------------------------------------------- */

function PluginCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-3 w-full bg-muted rounded" />
        </div>
        <div className="h-5 w-5 bg-muted rounded" />
      </div>
      <div className="flex items-center gap-2 mt-3">
        <div className="h-3 w-3 bg-muted rounded" />
        <div className="h-3 w-24 bg-muted rounded" />
      </div>
      <div className="flex gap-1.5 mt-3">
        <div className="h-5 w-16 bg-muted rounded" />
        <div className="h-5 w-20 bg-muted rounded" />
      </div>
    </div>
  );
}

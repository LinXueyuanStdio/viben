import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Store,
  Grid3X3,
  List,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Package,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import {
  SearchBar,
  CategoryFilter,
  PackageCard,
  PackageCardSkeleton,
  PackageDetail,
  SourceTabs,
  OfficialServerCard,
  OfficialServerCardSkeleton,
  OfficialServerDetail,
  type MarketplaceSource,
} from "@/components/marketplace";
import {
  useCloudMcp,
  type CloudMcpPackage,
} from "@/hooks/use-cloud-mcp";
import {
  useOfficialRegistry,
  type OfficialServerDisplay,
  type OfficialPackage,
} from "@/hooks/use-official-registry";

// Check if user prefers reduced motion
const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Easing curves
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: prefersReducedMotion ? 0 : 0.06,
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

type ViewMode = "grid" | "list";

export function MarketplacePage() {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [source, setSource] = useState<MarketplaceSource>("official");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [mounted, setMounted] = useState(false);

  // Community source state
  const [selectedPackage, setSelectedPackage] = useState<CloudMcpPackage | null>(null);
  const [communityDetailOpen, setCommunityDetailOpen] = useState(false);

  // Official source state
  const [selectedServer, setSelectedServer] = useState<OfficialServerDisplay | null>(null);
  const [officialDetailOpen, setOfficialDetailOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use the combined cloud MCP hook for community source
  const cloudMcp = useCloudMcp({
    page,
    limit: 20,
    category: selectedCategory ?? undefined,
    sort: "popular",
    fetchOnMount: source === "community",
  });

  // Use the official registry hook
  const officialRegistry = useOfficialRegistry({
    limit: 50,
    fetchOnMount: source === "official",
  });

  // Reset page when category or source changes
  useEffect(() => {
    setPage(1);
  }, [selectedCategory, source]);

  // Handle source change
  const handleSourceChange = useCallback((newSource: MarketplaceSource) => {
    setSource(newSource);
    setSelectedCategory(null);
    // Clear search when switching sources
    if (newSource === "official") {
      cloudMcp.clearSearch();
    } else {
      officialRegistry.clearSearch();
    }
  }, [cloudMcp, officialRegistry]);

  // Handle search input based on current source
  const handleSearch = useCallback((query: string) => {
    if (source === "official") {
      officialRegistry.search(query);
    } else {
      cloudMcp.search(query);
    }
  }, [source, officialRegistry, cloudMcp]);

  // Current search query based on source
  const currentSearchQuery = source === "official"
    ? officialRegistry.searchQuery
    : cloudMcp.searchQuery;

  // Calculate total pages (only for community)
  const totalPages = cloudMcp.displayPagination?.totalPages ?? 1;

  // Handle package selection (community)
  const handleSelectPackage = (pkg: CloudMcpPackage) => {
    setSelectedPackage(pkg);
    cloudMcp.selectPackage(pkg.id);
    setCommunityDetailOpen(true);
  };

  // Handle server selection (official)
  const handleSelectServer = (server: OfficialServerDisplay) => {
    setSelectedServer(server);
    officialRegistry.selectServer(server.id);
    setOfficialDetailOpen(true);
  };

  // Handle install (community)
  const handleInstallCommunity = (_pkg: CloudMcpPackage) => {
    // TODO: Implement actual installation logic
    // Will be implemented in a future PR
  };

  // Handle install (official)
  const handleInstallOfficial = (_pkg: OfficialPackage) => {
    // TODO: Implement actual installation logic
    // Will be implemented in a future PR
  };

  // Handle refresh based on current source
  const handleRefresh = async () => {
    if (source === "official") {
      await officialRegistry.refreshServers();
    } else {
      await Promise.all([cloudMcp.refetchPackages(), cloudMcp.refetchCategories()]);
    }
  };

  // Handle load more (official only - uses cursor-based pagination)
  const handleLoadMore = async () => {
    if (source === "official" && officialRegistry.hasMore) {
      await officialRegistry.loadMore();
    }
  };

  // Loading states
  const isLoading = source === "official"
    ? officialRegistry.isLoading
    : cloudMcp.packagesLoading || cloudMcp.searchLoading;

  const hasError = source === "official"
    ? officialRegistry.serversError
    : cloudMcp.packagesError;

  // Is searching
  const isSearching = source === "official"
    ? officialRegistry.isSearching
    : cloudMcp.isSearching;

  // Display data
  const displayServers = officialRegistry.displayServers;
  const displayPackages = cloudMcp.displayPackages;

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-serif">
              {t("marketplace.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("marketplace.subtitle")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="h-4 w-4" />
              <span className="sr-only">{t("marketplace.gridView")}</span>
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
              <span className="sr-only">{t("marketplace.listView")}</span>
            </Button>
          </div>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      {/* Source Tabs */}
      <div className="mb-4">
        <SourceTabs
          value={source}
          onValueChange={handleSourceChange}
          officialCount={officialRegistry.totalCount}
          communityCount={cloudMcp.displayPagination?.total}
          loading={isLoading}
        />
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <SearchBar
          value={currentSearchQuery}
          onChange={handleSearch}
          placeholder={
            source === "official"
              ? t("marketplace.searchOfficialPlaceholder")
              : t("marketplace.searchPlaceholder")
          }
          loading={source === "official" ? officialRegistry.searchLoading : cloudMcp.searchLoading}
          className="max-w-md"
        />
      </div>

      {/* Error Banner */}
      {hasError && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{hasError}</span>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex gap-6">
        {/* Category Sidebar (Community only) */}
        {source === "community" && (
          <aside className="w-56 shrink-0 hidden lg:block">
            <div className="rounded-lg border bg-card p-4 h-full">
              <h3 className="font-medium text-sm mb-3">
                {t("marketplace.categories")}
              </h3>
              <CategoryFilter
                categories={cloudMcp.categories}
                selectedCategory={selectedCategory}
                onSelect={(cat) => {
                  setSelectedCategory(cat);
                  cloudMcp.clearSearch();
                }}
                loading={cloudMcp.categoriesLoading}
              />
            </div>
          </aside>
        )}

        {/* Package/Server Grid */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Results Summary */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {source === "official" ? (
                isSearching
                  ? t("marketplace.searchResults", {
                      count: displayServers.length,
                      query: officialRegistry.searchQuery,
                    })
                  : t("marketplace.officialServersCount", {
                      count: officialRegistry.totalCount,
                    })
              ) : (
                isSearching
                  ? t("marketplace.searchResults", {
                      count: displayPackages.length,
                      query: cloudMcp.searchQuery,
                    })
                  : t("marketplace.packagesCount", {
                      count: cloudMcp.displayPagination?.total ?? 0,
                    })
              )}
            </p>
          </div>

          {/* Grid/List Content */}
          <ScrollArea className="flex-1">
            {source === "official" ? (
              /* Official Registry Content */
              isLoading && displayServers.length === 0 ? (
                <div
                  className={cn(
                    viewMode === "grid"
                      ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                      : "space-y-4"
                  )}
                >
                  {Array.from({ length: 6 }).map((_, i) => (
                    <OfficialServerCardSkeleton key={i} />
                  ))}
                </div>
              ) : displayServers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Package className="h-12 w-12 mb-4 opacity-50" />
                  <h3 className="text-lg font-medium">
                    {isSearching
                      ? t("marketplace.noSearchResults")
                      : t("marketplace.noOfficialServers")}
                  </h3>
                  <p className="text-sm mt-1">
                    {isSearching
                      ? t("marketplace.tryDifferentSearch")
                      : t("marketplace.checkBackLater")}
                  </p>
                </div>
              ) : (
                <>
                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate={mounted ? "visible" : "hidden"}
                    className={cn(
                      viewMode === "grid"
                        ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                        : "space-y-4",
                      "pb-4"
                    )}
                  >
                    {displayServers.map((server) => (
                      <motion.div key={server.id} variants={itemVariants}>
                        <OfficialServerCard
                          server={server}
                          onSelect={() => handleSelectServer(server)}
                          onInstall={() => {
                            // If only one package, install directly
                            const packages = server._original?.server?.packages;
                            if (packages && packages.length === 1) {
                              handleInstallOfficial(packages[0]);
                            } else {
                              handleSelectServer(server);
                            }
                          }}
                          installed={false}
                        />
                      </motion.div>
                    ))}
                  </motion.div>

                  {/* Load More Button (Official uses cursor pagination) */}
                  {officialRegistry.hasMore && (
                    <div className="flex justify-center pt-4 pb-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLoadMore}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <ChevronDown className="h-4 w-4 mr-2" />
                        )}
                        {t("marketplace.loadMore")}
                      </Button>
                    </div>
                  )}
                </>
              )
            ) : (
              /* Community Content */
              isLoading && displayPackages.length === 0 ? (
                <div
                  className={cn(
                    viewMode === "grid"
                      ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                      : "space-y-4"
                  )}
                >
                  {Array.from({ length: 6 }).map((_, i) => (
                    <PackageCardSkeleton key={i} />
                  ))}
                </div>
              ) : displayPackages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Package className="h-12 w-12 mb-4 opacity-50" />
                  <h3 className="text-lg font-medium">
                    {isSearching
                      ? t("marketplace.noSearchResults")
                      : t("marketplace.noPackages")}
                  </h3>
                  <p className="text-sm mt-1">
                    {isSearching
                      ? t("marketplace.tryDifferentSearch")
                      : t("marketplace.checkBackLater")}
                  </p>
                </div>
              ) : (
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate={mounted ? "visible" : "hidden"}
                  className={cn(
                    viewMode === "grid"
                      ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                      : "space-y-4",
                    "pb-4"
                  )}
                >
                  {displayPackages.map((pkg) => (
                    <motion.div key={pkg.id} variants={itemVariants}>
                      <PackageCard
                        package={pkg}
                        onSelect={() => handleSelectPackage(pkg)}
                        onInstall={() => handleInstallCommunity(pkg)}
                        installed={false}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )
            )}
          </ScrollArea>

          {/* Pagination (Community only) */}
          {source === "community" && !isSearching && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4 border-t mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
                {t("marketplace.previous")}
              </Button>
              <span className="text-sm text-muted-foreground px-4">
                {t("marketplace.pageOf", { page, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
              >
                {t("marketplace.next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Community Package Detail Dialog */}
      <PackageDetail
        package={cloudMcp.selectedPackage || selectedPackage}
        open={communityDetailOpen}
        onOpenChange={setCommunityDetailOpen}
        onInstall={() => selectedPackage && handleInstallCommunity(selectedPackage)}
        loading={cloudMcp.selectedPackageLoading}
        installed={false}
      />

      {/* Official Server Detail Dialog */}
      <OfficialServerDetail
        server={officialRegistry.selectedServer || selectedServer}
        open={officialDetailOpen}
        onOpenChange={setOfficialDetailOpen}
        onInstall={handleInstallOfficial}
        loading={officialRegistry.selectedServerLoading}
        installed={false}
        versions={officialRegistry.serverVersions}
        versionsLoading={officialRegistry.versionsLoading}
        selectedVersion={officialRegistry.selectedVersion}
        onVersionChange={officialRegistry.selectServerVersion}
      />
    </div>
  );
}

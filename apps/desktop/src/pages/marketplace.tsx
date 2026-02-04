import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
} from "@/components/marketplace";
import {
  useCloudMcp,
  type CloudMcpPackage,
} from "@/hooks/use-cloud-mcp";

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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedPackage, setSelectedPackage] = useState<CloudMcpPackage | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use the combined cloud MCP hook
  const {
    // Package list
    packages,
    packagesLoading,
    packagesError,
    packagesPagination,
    refetchPackages,

    // Search
    searchResults,
    searchLoading,
    search,
    searchQuery,
    clearSearch,

    // Categories
    categories,
    categoriesLoading,
    refetchCategories,

    // Selected package
    selectedPackage: detailedPackage,
    selectedPackageLoading,
    selectPackage,

    // Computed
    displayPackages,
    displayPagination,
    isSearching,
  } = useCloudMcp({
    page,
    limit: 20,
    category: selectedCategory ?? undefined,
    sort: "popular",
    fetchOnMount: true,
  });

  // Reset page when category changes
  useEffect(() => {
    setPage(1);
  }, [selectedCategory]);

  // Calculate total pages
  const totalPages = displayPagination?.totalPages ?? 1;

  // Handle package selection
  const handleSelectPackage = (pkg: CloudMcpPackage) => {
    setSelectedPackage(pkg);
    selectPackage(pkg.id);
    setDetailOpen(true);
  };

  // Handle install (placeholder - actual implementation would be in TD9)
  const handleInstall = (pkg: CloudMcpPackage) => {
    // TODO: Implement actual installation logic in TD9
    console.log("Installing package:", pkg.slug);
  };

  // Handle refresh
  const handleRefresh = async () => {
    await Promise.all([refetchPackages(), refetchCategories()]);
  };

  // Loading state
  const isLoading = packagesLoading || searchLoading;
  const hasError = packagesError;

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

      {/* Search Bar */}
      <div className="mb-4">
        <SearchBar
          value={searchQuery}
          onChange={search}
          placeholder={t("marketplace.searchPlaceholder")}
          loading={searchLoading}
          className="max-w-md"
        />
      </div>

      {/* Error Banner */}
      {hasError && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{packagesError}</span>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex gap-6">
        {/* Category Sidebar */}
        <aside className="w-56 shrink-0 hidden lg:block">
          <div className="rounded-lg border bg-card p-4 h-full">
            <h3 className="font-medium text-sm mb-3">
              {t("marketplace.categories")}
            </h3>
            <CategoryFilter
              categories={categories}
              selectedCategory={selectedCategory}
              onSelect={(cat) => {
                setSelectedCategory(cat);
                clearSearch();
              }}
              loading={categoriesLoading}
            />
          </div>
        </aside>

        {/* Package Grid */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Results Summary */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {isSearching
                ? t("marketplace.searchResults", {
                    count: displayPackages.length,
                    query: searchQuery,
                  })
                : t("marketplace.packagesCount", {
                    count: displayPagination?.total ?? 0,
                  })}
            </p>
          </div>

          {/* Package Grid/List */}
          <ScrollArea className="flex-1">
            {isLoading && displayPackages.length === 0 ? (
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
                      onInstall={() => handleInstall(pkg)}
                      installed={false}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </ScrollArea>

          {/* Pagination */}
          {!isSearching && totalPages > 1 && (
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

      {/* Package Detail Dialog */}
      <PackageDetail
        package={detailedPackage || selectedPackage}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onInstall={() => selectedPackage && handleInstall(selectedPackage)}
        loading={selectedPackageLoading}
        installed={false}
      />
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  RefreshCw,
  Sparkles,
  Grid3X3,
  List,
  ChevronLeft,
  ChevronRight,
  Package,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  SkillCard,
  SkillCardSkeleton,
  SkillDetail,
  CategoryFilter,
  SearchBar,
} from "@/components/skills";
import {
  useCloudSkillPackages,
  useCloudSkillSearch,
  useCloudSkillCategories,
  type CloudSkillPackage,
} from "@/hooks/use-cloud-skills";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

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
type SortOption = "latest" | "popular" | "downloads";

export function SkillsMarketPage() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  // View and filter state
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const sortBy: SortOption = "popular"; // Default sort order, matching MCP marketplace
  const [page, setPage] = useState(1);

  // Detail dialog state
  const [selectedSkill, setSelectedSkill] = useState<CloudSkillPackage | null>(
    null
  );
  const [detailOpen, setDetailOpen] = useState(false);

  // Install state (for future implementation)
  const [installingIds, setInstallingIds] = useState<Set<string>>(new Set());
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());

  // Hooks
  const {
    packages,
    pagination,
    loading: packagesLoading,
    error: packagesError,
    refetch: refetchPackages,
  } = useCloudSkillPackages({
    page,
    limit: 20,
    category: selectedCategory ?? undefined,
    sort: sortBy,
  });

  const {
    results: searchResults,
    loading: searchLoading,
    error: searchError,
  } = useCloudSkillSearch(searchQuery, 300);

  const {
    categories,
    loading: categoriesLoading,
    error: categoriesError,
    refetch: refetchCategories,
  } = useCloudSkillCategories();

  // Determine which data to display
  const displayedPackages = searchQuery.trim() ? searchResults : packages;
  const isLoading =
    searchQuery.trim() ? searchLoading : packagesLoading || categoriesLoading;
  const error = packagesError || searchError || categoriesError;

  // Filter by type if selected
  const filteredPackages = useMemo(() => {
    if (!selectedType) return displayedPackages;
    return displayedPackages.filter((pkg) => pkg.skillType === selectedType);
  }, [displayedPackages, selectedType]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedCategory, searchQuery]);

  // Handle refresh
  const handleRefresh = async () => {
    await Promise.all([refetchPackages(), refetchCategories(true)]);
  };

  // Handle view details
  const handleViewDetails = (skill: CloudSkillPackage) => {
    setSelectedSkill(skill);
    setDetailOpen(true);
  };

  // Handle install (placeholder for future implementation)
  const handleInstall = async (skill: CloudSkillPackage) => {
    setInstallingIds((prev) => new Set(prev).add(skill.id));

    // Simulate installation delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setInstallingIds((prev) => {
      const next = new Set(prev);
      next.delete(skill.id);
      return next;
    });
    setInstalledIds((prev) => new Set(prev).add(skill.id));
  };

  // Calculate total pages
  const totalPages = pagination?.totalPages ?? 1;

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-serif">
              {t("skillsMarket.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("skillsMarket.subtitle")}
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
              <span className="sr-only">{t("skillsMarket.gridView")}</span>
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
              <span className="sr-only">{t("skillsMarket.listView")}</span>
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
          onChange={setSearchQuery}
          placeholder={t("skillsMarket.searchPlaceholder")}
          loading={searchLoading}
          className="max-w-md"
        />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex gap-6">
        {/* Sidebar - Category Filter */}
        <aside className="w-56 shrink-0 hidden lg:block">
          <div className="rounded-lg border bg-card p-4 h-full">
            <h3 className="font-medium text-sm mb-3">
              {t("skillsMarket.categories")}
            </h3>
            <CategoryFilter
              categories={categories}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              selectedType={selectedType}
              onTypeChange={setSelectedType}
              loading={categoriesLoading}
            />
          </div>
        </aside>

        {/* Package Grid */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Results Summary */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {searchQuery.trim()
                ? t("skillsMarket.searchResults", {
                    count: filteredPackages.length,
                    query: searchQuery,
                  })
                : t("skillsMarket.packagesCount", {
                    count: pagination?.total ?? 0,
                  })}
            </p>
          </div>

          {/* Skills Grid/List */}
          <ScrollArea className="flex-1">
            {isLoading && filteredPackages.length === 0 ? (
              <div
                className={cn(
                  viewMode === "grid"
                    ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                    : "space-y-4"
                )}
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkillCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredPackages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Package className="h-12 w-12 mb-4 opacity-50" />
                <h3 className="text-lg font-medium">
                  {searchQuery.trim()
                    ? t("skillsMarket.noSearchResults")
                    : t("skillsMarket.noPackages")}
                </h3>
                <p className="text-sm mt-1">
                  {searchQuery.trim()
                    ? t("skillsMarket.tryDifferentSearch")
                    : t("skillsMarket.checkBackLater")}
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
                {filteredPackages.map((skill) => (
                  <motion.div key={skill.id} variants={itemVariants}>
                    <SkillCard
                      skill={skill}
                      onViewDetails={handleViewDetails}
                      isInstalled={installedIds.has(skill.id)}
                      isInstalling={installingIds.has(skill.id)}
                      onInstall={handleInstall}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </ScrollArea>

          {/* Pagination */}
          {!searchQuery.trim() && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4 border-t mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
                {t("skillsMarket.previous")}
              </Button>
              <span className="text-sm text-muted-foreground px-4">
                {t("skillsMarket.pageOf", { page, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
              >
                {t("skillsMarket.next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Skill Detail Dialog */}
      <SkillDetail
        skill={selectedSkill}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        isInstalled={selectedSkill ? installedIds.has(selectedSkill.id) : false}
        isInstalling={
          selectedSkill ? installingIds.has(selectedSkill.id) : false
        }
        onInstall={handleInstall}
      />
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
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
import { useAnalytics } from "@/lib/analytics";
import { AnalyticsEvents } from "@/lib/analytics/types";
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
  getInstallCommand,
  type OfficialServerDisplay,
  type OfficialPackage,
} from "@/hooks/use-official-registry";
import { getGatewayClient } from "@/lib/gateway";
import { toast } from "@/hooks/use-toast";
import type { WorkspaceMcpServerConfig } from "@/lib/gateway/types";

// Easing curves
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

type ViewMode = "grid" | "list";

/**
 * Build a WorkspaceMcpServerConfig from an OfficialPackage.
 *
 * Maps registry type + transport to the correct command/args/url shape
 * so the gateway can persist it into the executor's MCP config file.
 */
function buildMcpServerConfig(
  serverName: string,
  pkg: OfficialPackage
): WorkspaceMcpServerConfig {
  const installCommand = getInstallCommand(pkg);

  // Collect environment variables with default/preset values
  const env: Record<string, string> = {};
  if (pkg.environmentVariables) {
    for (const envVar of pkg.environmentVariables) {
      env[envVar.name] = envVar.value || envVar.default || "";
    }
  }

  // For remote transports (SSE / streamable-http), set the URL directly
  if (pkg.transport.type === "sse" || pkg.transport.type === "streamable-http") {
    const transport = pkg.transport as { type: string; url: string };
    return {
      name: serverName,
      url: transport.url,
      transport: pkg.transport.type,
      ...(Object.keys(env).length > 0 ? { env } : {}),
    };
  }

  // For stdio transport, build command + args based on registry type
  switch (pkg.registryType) {
    case "npm": {
      const identifier = pkg.version
        ? `${pkg.identifier}@${pkg.version}`
        : pkg.identifier;
      return {
        name: serverName,
        command: "npx",
        args: ["-y", identifier],
        transport: "stdio",
        ...(Object.keys(env).length > 0 ? { env } : {}),
      };
    }
    case "pypi": {
      const identifier = pkg.version
        ? `${pkg.identifier}==${pkg.version}`
        : pkg.identifier;
      return {
        name: serverName,
        command: "uvx",
        args: [identifier],
        transport: "stdio",
        ...(Object.keys(env).length > 0 ? { env } : {}),
      };
    }
    case "oci": {
      const identifier = pkg.version
        ? `${pkg.identifier}:${pkg.version}`
        : pkg.identifier;
      return {
        name: serverName,
        command: "docker",
        args: ["run", "-i", "--rm", identifier],
        transport: "stdio",
        ...(Object.keys(env).length > 0 ? { env } : {}),
      };
    }
    default: {
      // Fallback: use the install command as a single shell command
      return {
        name: serverName,
        command: installCommand,
        args: [],
        transport: "stdio",
        ...(Object.keys(env).length > 0 ? { env } : {}),
      };
    }
  }
}

export function MarketplacePage() {
  const { t } = useTranslation();
  const { logEvent } = useAnalytics();
  const prefersReducedMotion = useReducedMotion();
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

  // Installation state
  const [installingCommunity, setInstallingCommunity] = useState(false);
  const [installingOfficial, setInstallingOfficial] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Track marketplace opened
  useEffect(() => {
    try { logEvent(AnalyticsEvents.MCP_MARKETPLACE_OPENED, { source: "sidebar" }); } catch {}
  }, []);

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
    const startTime = Date.now();
    if (source === "official") {
      officialRegistry.search(query);
    } else {
      cloudMcp.search(query);
    }
    try {
      logEvent(AnalyticsEvents.MCP_MARKETPLACE_SEARCHED, {
        search_query: query,
        results_count: 0,
        search_duration_ms: Date.now() - startTime,
      });
    } catch {}
  }, [source, officialRegistry, cloudMcp, logEvent]);

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
    try {
      logEvent(AnalyticsEvents.MCP_PACKAGE_DETAIL_VIEWED, {
        package_name: pkg.name,
        package_source: "community",
        package_version: pkg.version || "latest",
      });
    } catch {}
  };

  // Handle server selection (official)
  const handleSelectServer = (server: OfficialServerDisplay) => {
    setSelectedServer(server);
    officialRegistry.selectServer(server.id);
    setOfficialDetailOpen(true);
    try {
      logEvent(AnalyticsEvents.MCP_PACKAGE_DETAIL_VIEWED, {
        package_name: server.name,
        package_source: "official",
        package_version: server.version || "latest",
      });
    } catch {}
  };

  // Handle install (community)
  const handleInstallCommunity = async (pkg: CloudMcpPackage) => {
    setInstallingCommunity(true);
    const startTime = Date.now();
    try {
      logEvent(AnalyticsEvents.MCP_PACKAGE_INSTALL_STARTED, {
        package_name: pkg.name,
        package_version: pkg.version || "latest",
        install_source: "marketplace",
      });
    } catch {}

    try {
      const gateway = getGatewayClient();

      // Build MCP server config from community package
      const serverConfig: WorkspaceMcpServerConfig = {
        name: pkg.name,
        ...(pkg.transport === "stdio"
          ? {
              command: `pip install ${pkg.slug} && ${pkg.slug}`,
              transport: "stdio",
            }
          : {
              url: pkg.repositoryUrl || undefined,
              transport: "sse",
            }),
      };

      // Add to global config (no workspace path = global, default executor)
      await gateway.addMcpServer(undefined, "CLAUDE_CODE", serverConfig);

      toast.success(t("marketplace.installSuccess"), {
        description: t("marketplace.installSuccessDesc", { name: pkg.name }),
      });
      setCommunityDetailOpen(false);
      try {
        logEvent(AnalyticsEvents.MCP_PACKAGE_INSTALL_COMPLETED, {
          package_name: pkg.name,
          package_version: pkg.version || "latest",
          install_source: "marketplace",
          duration_ms: Date.now() - startTime,
          success: true,
        });
      } catch {}
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(t("marketplace.installFailed"), {
        description: message,
      });
      try {
        logEvent(AnalyticsEvents.MCP_PACKAGE_INSTALL_FAILED, {
          package_name: pkg.name,
          error_type: err instanceof Error ? err.name : "UnknownError",
          error_message: message,
          duration_ms: Date.now() - startTime,
        });
      } catch {}
    } finally {
      setInstallingCommunity(false);
    }
  };

  // Handle install (official)
  const handleInstallOfficial = async (pkg: OfficialPackage) => {
    setInstallingOfficial(true);
    const startTime = Date.now();
    const serverName =
      selectedServer?.name || pkg.identifier.split("/").pop() || pkg.identifier;
    try {
      logEvent(AnalyticsEvents.MCP_PACKAGE_INSTALL_STARTED, {
        package_name: serverName,
        package_version: pkg.version || "latest",
        install_source: "official",
      });
    } catch {}

    try {
      const gateway = getGatewayClient();

      // Build MCP server config from official package
      const serverConfig: WorkspaceMcpServerConfig =
        buildMcpServerConfig(serverName, pkg);

      // Add to global config (no workspace path = global, default executor)
      await gateway.addMcpServer(undefined, "CLAUDE_CODE", serverConfig);

      toast.success(t("marketplace.installSuccess"), {
        description: t("marketplace.installSuccessDesc", { name: serverName }),
      });
      setOfficialDetailOpen(false);
      try {
        logEvent(AnalyticsEvents.MCP_PACKAGE_INSTALL_COMPLETED, {
          package_name: serverName,
          package_version: pkg.version || "latest",
          install_source: "official",
          duration_ms: Date.now() - startTime,
          success: true,
        });
      } catch {}
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(t("marketplace.installFailed"), {
        description: message,
      });
      try {
        logEvent(AnalyticsEvents.MCP_PACKAGE_INSTALL_FAILED, {
          package_name: serverName,
          error_type: err instanceof Error ? err.name : "UnknownError",
          error_message: message,
          duration_ms: Date.now() - startTime,
        });
      } catch {}
    } finally {
      setInstallingOfficial(false);
    }
  };

  // Handle refresh based on current source
  const handleRefresh = async () => {
    if (source === "official") {
      await officialRegistry.refreshServers();
    } else {
      await Promise.all([cloudMcp.refetchPackages(), cloudMcp.refetchCategories()]);
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

  // Infinite scroll observer ref
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Load more trigger ref callback for infinite scroll
  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading) return;
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && officialRegistry.hasMore && !isLoading) {
            officialRegistry.loadMore();
          }
        },
        { threshold: 0.1 }
      );

      if (node) {
        observerRef.current.observe(node);
      }
    },
    [isLoading, officialRegistry]
  );

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
                        />
                      </motion.div>
                    ))}
                  </motion.div>

                  {/* Infinite scroll trigger */}
                  {officialRegistry.hasMore && (
                    <div
                      ref={loadMoreRef}
                      className="flex items-center justify-center py-8"
                    >
                      {isLoading ? (
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      ) : (
                        <Button variant="outline" onClick={() => officialRegistry.loadMore()}>
                          {t("marketplace.loadMore")}
                        </Button>
                      )}
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
        onInstall={() => {
          const pkg = cloudMcp.selectedPackage || selectedPackage;
          if (pkg) handleInstallCommunity(pkg);
        }}
        loading={cloudMcp.selectedPackageLoading}
        installed={installingCommunity}
      />

      {/* Official Server Detail Dialog */}
      <OfficialServerDetail
        server={officialRegistry.selectedServer || selectedServer}
        open={officialDetailOpen}
        onOpenChange={setOfficialDetailOpen}
        onInstall={handleInstallOfficial}
        loading={officialRegistry.selectedServerLoading}
        installed={installingOfficial}
        versions={officialRegistry.serverVersions}
        versionsLoading={officialRegistry.versionsLoading}
        selectedVersion={officialRegistry.selectedVersion}
        onVersionChange={officialRegistry.selectServerVersion}
      />
    </div>
  );
}

import { Link } from "react-router-dom";
import { Search, Database, Activity, Settings, ArrowRight, TrendingUp, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton, SkeletonCard, SkeletonChart, SkeletonHeatmap } from "@/components/ui/skeleton";
import { BentoGrid, BentoCard } from "@/components/layout";
import { useAgents } from "@/hooks/use-agents";
import { usePython } from "@/hooks/use-python";
import { useUsage } from "@/hooks/use-usage";
import { useAppStore } from "@/stores";
import { useMemo, useEffect, useState } from "react";

// Check if user prefers reduced motion
const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Easing curves as const tuples for Framer Motion type compatibility
const easeOutExpo = [0.16, 1, 0.3, 1] as const;
const easeOutBack = [0.34, 1.56, 0.64, 1] as const;

export function DashboardPage() {
  const { agents, loading: agentsLoading } = useAgents();
  const { selectedPython, browseMcpInfo } = usePython();
  const { stats, loading: usageLoading } = useUsage();
  const {
    providers,
    mcpServers,
    getAvailableProviders,
    setupBannerDismissed,
    setSetupBannerDismissed,
    setupStatus,
    setSetupStatus,
    shouldCheckSetup,
  } = useAppStore();

  const installedAgents = agents.filter((a) => a.installed);
  const configuredAgents = agents.filter((a) => a.configured);
  const availableProviders = getAvailableProviders();
  const runningServers = mcpServers.filter((s) => s.status === "running");

  // Check setup status with caching
  useEffect(() => {
    // Only check if data is actually loaded
    if (selectedPython !== null && browseMcpInfo !== undefined) {
      const isSetupComplete = selectedPython?.is_valid && browseMcpInfo?.installed;

      // Only update if we should check (first time or after 5 minutes)
      if (shouldCheckSetup()) {
        setSetupStatus(isSetupComplete);
      }
    }
  }, [selectedPython, browseMcpInfo, shouldCheckSetup, setSetupStatus]);

  // Determine if we should show the setup banner
  // Default to NOT showing unless we have confirmed evidence that setup is incomplete
  const showSetupBanner = useMemo(() => {
    // If user dismissed it, never show
    if (setupBannerDismissed) return false;

    // If we have cached status, trust it completely
    if (setupStatus !== null) {
      return !setupStatus.isComplete; // Only show if cache says incomplete
    }

    // No cache - only show if data is loaded AND setup is actually incomplete
    // If data is still loading (null/undefined), default to NOT showing the banner
    const dataIsLoaded = selectedPython !== null && browseMcpInfo !== undefined;
    if (!dataIsLoaded) {
      return false; // Don't show during loading
    }

    // Data is loaded - check actual status
    const isSetupComplete = selectedPython?.is_valid && browseMcpInfo?.installed;
    return !isSetupComplete; // Show only if definitely incomplete
  }, [setupStatus, setupBannerDismissed, selectedPython, browseMcpInfo]);

  return (
    <div className="p-6">
      {/* Page title - no individual animation, AppLayout handles page transitions */}
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Setup Banner - only shown if not complete AND not dismissed */}
      <AnimatePresence mode="wait">
        {showSetupBanner && (
          <motion.div
            key="setup-banner"
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="p-4 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950 theme-transition relative overflow-hidden"
          >
            <button
              onClick={() => setSetupBannerDismissed(true)}
              className="absolute top-2 right-2 p-1 hover:bg-yellow-200 dark:hover:bg-yellow-800 rounded transition-colors"
              aria-label="Dismiss setup banner"
            >
              <svg className="w-4 h-4 text-yellow-800 dark:text-yellow-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex items-start justify-between pr-8">
              <div>
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                  Setup Required
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  {!selectedPython?.is_valid
                    ? "Python 3.10+ is required to run browse-mcp."
                    : "Install the browse-mcp package to get started."}
                </p>
              </div>
              <Button asChild size="sm">
                <Link to="/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure
                </Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Dashboard Grid - Using Bento Grid with animations */}
      <BentoGrid gap="lg">
        {/* Stats Row - 4 small cards */}
        <BentoCard size="small">
          {usageLoading ? (
            <SkeletonCard className="border-0 p-0 bg-transparent" />
          ) : (
            <StatCardContent
              title="Total Requests"
              value={(stats?.total_requests ?? 0).toLocaleString()}
              description="All time"
              icon={Search}
            />
          )}
        </BentoCard>
        <BentoCard size="small">
          {usageLoading ? (
            <SkeletonCard className="border-0 p-0 bg-transparent" />
          ) : (
            <StatCardContent
              title="Today"
              value={(stats?.today_requests ?? 0).toLocaleString()}
              description={`This week: ${(stats?.this_week_requests ?? 0).toLocaleString()}`}
              icon={TrendingUp}
            />
          )}
        </BentoCard>
        <BentoCard size="small">
          <Link to="/providers" className="block h-full -m-6 p-6 hover:bg-muted/50 transition-all duration-200 hover:-translate-y-0.5 rounded-lg">
            {usageLoading ? (
              <SkeletonCard className="border-0 p-0 bg-transparent" />
            ) : (
              <StatCardContent
                title="Data Sources"
                value={`${availableProviders.length}`}
                description={`Out of ${providers.length} configured`}
                icon={Database}
              />
            )}
          </Link>
        </BentoCard>
        <BentoCard size="small">
          <Link to="/search-service" className="block h-full -m-6 p-6 hover:bg-muted/50 transition-all duration-200 hover:-translate-y-0.5 rounded-lg">
            {usageLoading ? (
              <SkeletonCard className="border-0 p-0 bg-transparent" />
            ) : (
              <StatCardContent
                title="MCP Servers"
                value={`${runningServers.length}/${mcpServers.length}`}
                description={
                  runningServers.length > 0
                    ? `${runningServers.length} running`
                    : mcpServers.length > 0
                    ? "All stopped"
                    : "No servers"
                }
                icon={Activity}
                valueClassName={runningServers.length > 0 ? "text-green-600" : "text-muted-foreground"}
              />
            )}
          </Link>
        </BentoCard>

        {/* Row 2: Daily Usage Chart (large) + Quick Actions (small, stacked vertically) */}
        <BentoCard size="large">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Daily Usage (Last 30 Days)
          </h2>
          {usageLoading ? (
            <SkeletonChart className="border-0 p-0" />
          ) : (
            <UsageLineChart data={stats?.daily_usage ?? []} />
          )}
        </BentoCard>

        {/* Right side: 2 Quick Actions stacked vertically in one grid cell */}
        <BentoCard size="small" asCard={false} className="flex flex-col gap-6">
          <QuickActionCard
            title="Configure AI Agents"
            description="Set up browse-mcp for your AI assistants"
            linkTo="/agents"
            count={`${configuredAgents.length}/${installedAgents.length} configured`}
          />
          <QuickActionCard
            title="Manage Data Sources"
            description="Configure API keys for search sources"
            linkTo="/providers"
            count={`${availableProviders.length} available`}
          />
        </BentoCard>

        {/* Row 3: Usage by Server + Usage by Data Source */}
        <BentoCard size="medium">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Usage by Server
          </h2>
          {usageLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <UsageByCategory
              data={stats?.by_server ?? {}}
              labelMap={Object.fromEntries(mcpServers.map((s) => [s.id, s.name]))}
              emptyMessage="No server usage data yet"
            />
          )}
        </BentoCard>

        <BentoCard size="medium">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Database className="h-5 w-5" />
            Usage by Data Source
          </h2>
          {usageLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <UsageByCategory
              data={stats?.by_source ?? {}}
              labelMap={Object.fromEntries(providers.map((p) => [p.id, p.name]))}
              emptyMessage="No source usage data yet"
            />
          )}
        </BentoCard>

        {/* Row 4: Activity Heatmap - Full width */}
        <BentoCard size="full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Activity
            </h2>
            <span className="text-sm text-muted-foreground">
              {stats?.this_month_requests ?? 0} requests this month
            </span>
          </div>
          {usageLoading ? (
            <SkeletonHeatmap />
          ) : (
            <ActivityHeatmap data={stats?.activity_heatmap ?? []} />
          )}
        </BentoCard>

        {/* Environment Status - Full width */}
        <BentoCard size="full">
          <h2 className="text-lg font-semibold mb-4">Environment Status</h2>
          <div className="space-y-3">
            <StatusRow
              label="Python"
              value={
                selectedPython
                  ? `${selectedPython.version} (${selectedPython.path})`
                  : "Not configured"
              }
              ok={selectedPython?.is_valid ?? false}
            />
            <StatusRow
              label="browse-mcp"
              value={
                browseMcpInfo?.installed
                  ? `v${browseMcpInfo.version}`
                  : "Not installed"
              }
              ok={browseMcpInfo?.installed ?? false}
            />
            <StatusRow
              label="MCP Servers"
              value={
                mcpServers.length === 0
                  ? "No servers configured"
                  : `${runningServers.length}/${mcpServers.length} running`
              }
              ok={runningServers.length > 0}
            />
            <StatusRow
              label="Configured Agents"
              value={agentsLoading ? "Detecting..." : `${configuredAgents.length} agents`}
              ok={configuredAgents.length > 0}
            />
          </div>
        </BentoCard>
      </BentoGrid>
    </div>
  );
}

// Activity Heatmap Component (GitHub-style) with Cascade Animation
interface ActivityHeatmapProps {
  data: { date: string; count: number; level: number }[];
}

function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Organize data into weeks
  const weeks = useMemo(() => {
    const result: { date: string; count: number; level: number }[][] = [];
    let currentWeek: { date: string; count: number; level: number }[] = [];

    // Fill in the first week with empty days if needed
    if (data.length > 0) {
      const firstDate = new Date(data[0].date);
      const dayOfWeek = firstDate.getDay();
      for (let i = 0; i < dayOfWeek; i++) {
        currentWeek.push({ date: "", count: 0, level: -1 });
      }
    }

    for (const day of data) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        result.push(currentWeek);
        currentWeek = [];
      }
    }

    // Push remaining days
    if (currentWeek.length > 0) {
      result.push(currentWeek);
    }

    return result;
  }, [data]);

  const levelColors = [
    "bg-muted",
    "bg-green-200 dark:bg-green-900",
    "bg-green-300 dark:bg-green-700",
    "bg-green-500 dark:bg-green-500",
    "bg-green-700 dark:bg-green-400",
  ];

  const months = useMemo(() => {
    const result: { name: string; startWeek: number }[] = [];
    let lastMonth = "";

    weeks.forEach((week, weekIndex) => {
      for (const day of week) {
        if (day.date) {
          const date = new Date(day.date);
          const month = date.toLocaleString("default", { month: "short" });
          if (month !== lastMonth) {
            result.push({ name: month, startWeek: weekIndex });
            lastMonth = month;
          }
          break;
        }
      }
    });

    return result;
  }, [weeks]);

  if (data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-muted-foreground">
        No activity data yet. Start using MCP servers to see activity.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {/* Month labels */}
      <div className="flex mb-1 text-xs text-muted-foreground" style={{ paddingLeft: "20px" }}>
        {months.map((month, i) => (
          <span
            key={i}
            style={{
              marginLeft: i === 0 ? `${month.startWeek * 14}px` : `${(month.startWeek - (months[i - 1]?.startWeek ?? 0) - 1) * 14}px`,
            }}
          >
            {month.name}
          </span>
        ))}
      </div>

      <div className="flex gap-0.5">
        {/* Day labels */}
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground pr-1">
          <span className="h-3"></span>
          <span className="h-3">Mon</span>
          <span className="h-3"></span>
          <span className="h-3">Wed</span>
          <span className="h-3"></span>
          <span className="h-3">Fri</span>
          <span className="h-3"></span>
        </div>

        {/* Heatmap grid with cascade animation */}
        <div className="flex gap-0.5">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-0.5">
              {week.map((day, dayIndex) => {
                const delay = prefersReducedMotion ? 0 : (weekIndex + dayIndex) * 20;
                return (
                  <div
                    key={dayIndex}
                    className={`w-3 h-3 rounded-sm transition-colors theme-transition ${
                      day.level === -1 ? "bg-transparent" : levelColors[day.level]
                    } ${mounted && day.level !== -1 ? "heatmap-cell" : ""}`}
                    style={{
                      animationDelay: `${delay}ms`,
                      opacity: mounted ? undefined : 0,
                    }}
                    title={day.date ? `${day.date}: ${day.count} requests` : ""}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1 mt-2 text-xs text-muted-foreground">
        <span>Less</span>
        {levelColors.map((color, i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${color} theme-transition`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

// Line Chart Component with Draw Animation
interface UsageLineChartProps {
  data: { date: string; total_requests: number }[];
}

function UsageLineChart({ data }: UsageLineChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    const maxValue = Math.max(...data.map((d) => d.total_requests), 1);
    const points = data.map((d, i) => ({
      x: (i / (data.length - 1 || 1)) * 100,
      y: 100 - (d.total_requests / maxValue) * 100,
      date: d.date,
      value: d.total_requests,
    }));

    return { points, maxValue };
  }, [data]);

  if (!chartData || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-muted-foreground">
        No usage data yet. Start using MCP servers to see trends.
      </div>
    );
  }

  const pathD = chartData.points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const areaD = `${pathD} L 100 100 L 0 100 Z`;

  return (
    <div className="h-48 relative">
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-6 w-10 flex flex-col justify-between text-xs text-muted-foreground">
        <span>{chartData.maxValue}</span>
        <span>{Math.round(chartData.maxValue / 2)}</span>
        <span>0</span>
      </div>

      {/* Chart area */}
      <div className="ml-12 h-full pb-6">
        <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
          {/* Grid lines */}
          <line x1="0" y1="0" x2="100" y2="0" stroke="currentColor" strokeOpacity="0.1" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeOpacity="0.1" />
          <line x1="0" y1="100" x2="100" y2="100" stroke="currentColor" strokeOpacity="0.1" />

          {/* Area fill with fade animation - delayed to avoid page transition overlap */}
          <motion.path
            d={areaD}
            fill="url(#gradient)"
            initial={{ opacity: 0 }}
            animate={{ opacity: mounted ? 0.3 : 0 }}
            transition={{ duration: 0.7, delay: 0.8, ease: "easeOut" }}
          />

          {/* Line with draw animation - delayed to avoid page transition overlap */}
          {mounted ? (
            <motion.path
              d={pathD}
              fill="none"
              stroke="rgb(34, 197, 94)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.7,
                delay: 0.6,
                ease: "easeOut",
              }}
            />
          ) : (
            <path
              d={pathD}
              fill="none"
              stroke="rgb(34, 197, 94)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              style={{ opacity: 0 }}
            />
          )}

          {/* Points with stagger animation - delayed to avoid page transition overlap */}
          {chartData.points.map((p, i) => (
            <motion.circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="3"
              fill="rgb(34, 197, 94)"
              vectorEffect="non-scaling-stroke"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: mounted ? 1 : 0, scale: mounted ? 1 : 0 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.2,
                delay: prefersReducedMotion ? 0 : 1.3 + i * 0.02,
                ease: easeOutBack,
              }}
            >
              <title>{`${p.date}: ${p.value} requests`}</title>
            </motion.circle>
          ))}

          {/* Gradient definition */}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="rgb(34, 197, 94)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* X-axis labels */}
      <div className="absolute bottom-0 left-12 right-0 flex justify-between text-xs text-muted-foreground">
        {data.length > 0 && (
          <>
            <span>{data[0]?.date.slice(5)}</span>
            <span>{data[Math.floor(data.length / 2)]?.date.slice(5)}</span>
            <span>{data[data.length - 1]?.date.slice(5)}</span>
          </>
        )}
      </div>
    </div>
  );
}

// Usage by Category Component (bar chart style) with Grow Animation
interface UsageByCategoryProps {
  data: Record<string, number>;
  labelMap: Record<string, string>;
  emptyMessage: string;
}

function UsageByCategory({ data, labelMap, emptyMessage }: UsageByCategoryProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sortedData = useMemo(() => {
    return Object.entries(data)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);
  }, [data]);

  const maxValue = useMemo(() => {
    return Math.max(...sortedData.map(([, v]) => v), 1);
  }, [sortedData]);

  if (sortedData.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-3"
      initial="hidden"
      animate="show"
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: {
            // Delay stagger to avoid page transition overlap
            delayChildren: 0.6,
            staggerChildren: prefersReducedMotion ? 0 : 0.1,
          },
        },
      }}
    >
      {sortedData.map(([id, count], index) => (
        <motion.div
          key={id}
          className="space-y-1"
          variants={{
            hidden: { opacity: 0, x: -10 },
            show: {
              opacity: 1,
              x: 0,
              transition: {
                duration: 0.3,
                ease: easeOutExpo,
              },
            },
          }}
        >
          <div className="flex justify-between text-sm">
            <span className="truncate">{labelMap[id] || id}</span>
            <span className="text-muted-foreground">{count.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden theme-transition">
            <motion.div
              className="h-full bg-green-500 rounded-full origin-left"
              style={{ width: `${(count / maxValue) * 100}%` }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: mounted ? 1 : 0 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.5,
                delay: prefersReducedMotion ? 0 : index * 0.1,
                ease: easeOutExpo,
              }}
            />
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

interface StatCardContentProps {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  valueClassName?: string;
}

function StatCardContent({
  title,
  value,
  description,
  icon: Icon,
  valueClassName,
}: StatCardContentProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{title}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className={`text-2xl font-bold ${valueClassName || ""}`}>{value}</div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </>
  );
}

interface QuickActionCardProps {
  title: string;
  description: string;
  linkTo: string;
  count: string;
}

function QuickActionCard({ title, description, linkTo, count }: QuickActionCardProps) {
  return (
    <Link
      to={linkTo}
      className="flex items-center justify-between rounded-lg border bg-card p-4 hover:bg-muted/50 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md theme-transition flex-1"
    >
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="text-xs text-muted-foreground mt-1">{count}</p>
      </div>
      <ArrowRight className="h-5 w-5 text-muted-foreground" />
    </Link>
  );
}

interface StatusRowProps {
  label: string;
  value: string;
  ok: boolean;
}

function StatusRow({ label, value, ok }: StatusRowProps) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className={ok ? "text-foreground" : "text-muted-foreground"}>
          {value}
        </span>
        <div
          className={`h-2 w-2 rounded-full transition-colors duration-300 ${
            ok ? "bg-green-500" : "bg-muted"
          }`}
        />
      </div>
    </div>
  );
}
